// Stripe côté serveur. Voyaj ne détient jamais l'argent lui-même :
//   - course immédiate : autorisation à la demande, capture à la confirmation
//   - trajet programmé : paiement à la réservation, remboursement si annulation
//   - chauffeur : transfert vers son compte Connect Express après confirmation
import Stripe from 'npm:stripe@17';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { conflict, type Row } from './http.ts';

const key = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

export const stripe = new Stripe(key, {
  apiVersion: '2025-02-24.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

export const cryptoProvider = Stripe.createSubtleCryptoProvider();

/** Récupère ou crée le client Stripe du passager (id mémorisé sur le profil). */
export async function ensureCustomer(db: SupabaseClient, profile: Row, email?: string): Promise<string> {
  if (profile.stripe_customer_id) return profile.stripe_customer_id;
  const customer = await stripe.customers.create({
    email,
    name: profile.name ?? undefined,
    metadata: { userId: profile.id, platform: 'voyaj' },
  });
  await db.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', profile.id);
  return customer.id;
}

/**
 * Prépare ce dont la PaymentSheet de l'app a besoin :
 * client secret du PaymentIntent + clé éphémère du client (cartes enregistrées).
 */
export async function paymentSheetParams(customerId: string, paymentIntent: Stripe.PaymentIntent) {
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: '2025-02-24.acacia' },
  );
  return {
    paymentIntentClientSecret: paymentIntent.client_secret,
    ephemeralKey: ephemeralKey.secret,
    customerId,
    publishableKey: Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? '',
  };
}

/** Libère (autorisation non capturée) ou rembourse (déjà encaissé) un paiement. */
export async function releaseOrRefund(paymentIntentId: string, amountCents?: number): Promise<'released' | 'refunded' | 'none'> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status === 'requires_capture') {
    if (amountCents != null && amountCents < pi.amount_capturable) {
      // Remboursement partiel d'une autorisation = capturer seulement la part retenue.
      await stripe.paymentIntents.capture(paymentIntentId, { amount_to_capture: pi.amount_capturable - amountCents });
      return 'refunded';
    }
    await stripe.paymentIntents.cancel(paymentIntentId);
    return 'released';
  }
  if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(pi.status)) {
    await stripe.paymentIntents.cancel(paymentIntentId).catch(() => {});
    return 'released';
  }
  if (pi.status === 'succeeded') {
    await stripe.refunds.create({ payment_intent: paymentIntentId, amount: amountCents });
    return 'refunded';
  }
  return 'none';
}

/** Transfère les gains au chauffeur (compte Connect Express). */
export async function transferToDriver(db: SupabaseClient, params: {
  driverId: string;
  amountCents: number;
  entityId: string;
  sourceTransaction?: string;
}): Promise<string | null> {
  const { data: driver } = await db.from('profiles')
    .select('stripe_account_id, stripe_payouts_enabled').eq('id', params.driverId).single();
  if (!driver?.stripe_account_id || params.amountCents <= 0) return null;
  const transfer = await stripe.transfers.create({
    amount: params.amountCents,
    currency: 'eur',
    destination: driver.stripe_account_id,
    source_transaction: params.sourceTransaction,
    metadata: { entityId: params.entityId, platform: 'voyaj' },
  }, { idempotencyKey: `transfer-${params.entityId}` });
  return transfer.id;
}

/** Charge (latest_charge) d'un PaymentIntent, pour lier le transfert au paiement. */
export async function chargeOf(paymentIntentId: string): Promise<string | undefined> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  return (pi.latest_charge as string | null) ?? undefined;
}

export function assertStripeConfigured(): void {
  if (!key) throw conflict('Paiement non configuré (STRIPE_SECRET_KEY manquant)');
}
