// stripe-connect — Inscription du chauffeur chez Stripe (compte Express) pour
// recevoir ses gains. Renvoie un lien d'onboarding à ouvrir dans le navigateur,
// ou un lien vers son tableau de bord Stripe s'il est déjà inscrit.
//
// Entrée : { returnUrl? }  (par défaut : voyaj://payment)
import { adminClient, assertNotSuspended, forbidden, getProfile, requireUser, serve } from '../_shared/http.ts';
import { audit } from '../_shared/domain.ts';
import { assertStripeConfigured, stripe } from '../_shared/stripe.ts';

serve(async (req, body) => {
  const user = await requireUser(req);
  assertStripeConfigured();
  const db = adminClient();
  const profile = await getProfile(db, user.id);
  assertNotSuspended(profile);
  if (!profile.is_verified) throw forbidden('Vérifiez votre identité avant de configurer vos virements');

  const returnUrl = typeof body.returnUrl === 'string' && body.returnUrl.startsWith('voyaj://')
    ? body.returnUrl : 'voyaj://payment';
  // Stripe exige une URL https : une page relais renvoie vers l'app.
  const relay = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://voyajapp.com') + '/retour-app?to=' + encodeURIComponent(returnUrl);

  let accountId: string = profile.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'FR',
      email: user.email ?? undefined,
      capabilities: { transfers: { requested: true } },
      business_type: 'individual',
      metadata: { userId: user.id, platform: 'voyaj' },
    });
    accountId = account.id;
    await db.from('profiles').update({ stripe_account_id: accountId }).eq('id', user.id);
    await audit(db, { action: 'stripe.account_created', actorId: user.id, entityType: 'user', entityId: user.id });
  }

  const account = await stripe.accounts.retrieve(accountId);
  if (account.details_submitted) {
    const login = await stripe.accounts.createLoginLink(accountId);
    return { url: login.url, onboarded: true, payoutsEnabled: !!account.payouts_enabled };
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: 'account_onboarding',
    refresh_url: relay,
    return_url: relay,
  });
  return { url: link.url, onboarded: false, payoutsEnabled: false };
});
