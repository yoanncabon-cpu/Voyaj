// stripe-webhook — Événements Stripe (signature vérifiée, traitement idempotent).
// Déployée avec --no-verify-jwt : Stripe n'envoie pas de JWT Supabase.
//
// Filet de sécurité : si l'app se ferme juste après le paiement, c'est ici
// que la course passe en recherche / que la réservation est confirmée.
import type Stripe from 'npm:stripe@17';
import { adminClient, json } from '../_shared/http.ts';
import { audit } from '../_shared/domain.ts';
import { confirmBooking } from '../_shared/bookings.ts';
import { cryptoProvider, stripe } from '../_shared/stripe.ts';

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const signature = req.headers.get('stripe-signature');
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature ?? '', WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch {
    return json({ error: 'invalid_signature' }, 400);
  }

  const db = adminClient();
  // Idempotence : l'insertion échoue si l'événement a déjà été reçu.
  const { error: dup } = await db.from('stripe_events').insert({ id: event.id, type: event.type });
  if (dup) return json({ received: true, duplicate: true });

  try {
    await handle(db, event);
    await db.from('stripe_events').update({ processed: true }).eq('id', event.id);
  } catch (e) {
    console.error('stripe event', event.id, e);
    await db.from('stripe_events').update({ error: String(e) }).eq('id', event.id);
    // 500 → Stripe réessaiera ; on retire la ligne pour autoriser le retraitement.
    await db.from('stripe_events').delete().eq('id', event.id);
    return json({ error: 'processing_failed' }, 500);
  }
  return json({ received: true });
});

async function handle(db: ReturnType<typeof adminClient>, event: Stripe.Event) {
  switch (event.type) {
    case 'payment_intent.amount_capturable_updated': {
      // Course immédiate autorisée : même effet que ride-confirm-payment
      // (sans relancer l'envoi aux chauffeurs, que l'app déclenche).
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.kind === 'instant') {
        await audit(db, { action: 'payment.authorized', actorId: 'stripe', entityType: 'ride', entityId: pi.metadata.rideId ?? pi.id });
      }
      break;
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.kind === 'scheduled' && pi.metadata.bookingId) {
        const { data: booking } = await db.from('bookings').select('*').eq('id', pi.metadata.bookingId).maybeSingle();
        if (booking?.status === 'pending_payment') await confirmBooking(db, booking);
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      await audit(db, {
        action: 'payment.failed', actorId: 'stripe', entityType: pi.metadata?.kind ?? 'payment',
        entityId: pi.metadata?.rideId ?? pi.metadata?.bookingId ?? pi.id,
        metadata: { reason: pi.last_payment_error?.message ?? null },
      });
      break;
    }
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      await db.from('profiles')
        .update({ stripe_payouts_enabled: !!(account.charges_enabled && account.payouts_enabled) })
        .eq('stripe_account_id', account.id);
      break;
    }
    case 'charge.dispute.created': {
      // Contestation bancaire : à traiter par l'admin.
      const d = event.data.object as Stripe.Dispute;
      await audit(db, { action: 'payment.chargeback', actorId: 'stripe', entityType: 'charge', entityId: String(d.charge), metadata: { amount: d.amount, reason: d.reason } });
      break;
    }
    default:
      break;
  }
}
