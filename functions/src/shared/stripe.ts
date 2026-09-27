import Stripe from 'stripe';

// Clé secrète injectée via Firebase Secret Manager (définie dans firebase.json)
const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? '';

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
  typescript: true,
});

/**
 * Crée un PaymentIntent avec autorisation uniquement (capture manuelle).
 * La capture a lieu après confirmation du trajet (ou automatiquement après 24 h).
 */
export async function createRidePaymentIntent(params: {
  amountCents: number; // passengerTotal en centimes
  currency: 'eur';
  customerId?: string;
  paymentMethodId?: string;
  rideId: string;
  driverStripeAccountId?: string; // pour le transfert différé
}): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount: params.amountCents,
    currency: params.currency,
    capture_method: 'manual',
    confirm: params.paymentMethodId != null,
    payment_method: params.paymentMethodId,
    customer: params.customerId,
    metadata: {
      rideId: params.rideId,
      platform: 'voyaj',
    },
    // Les fonds sont sur le compte Voyaj; le transfert vers le chauffeur
    // est initié séparément via stripe.transfers.create après confirmation.
  });
}

/**
 * Capture un PaymentIntent précédemment autorisé.
 */
export async function capturePaymentIntent(
  paymentIntentId: string,
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.capture(paymentIntentId);
}

/**
 * Rembourse totalement ou partiellement un PaymentIntent.
 */
export async function refundPaymentIntent(params: {
  paymentIntentId: string;
  amountCents?: number; // si absent → remboursement total
  reason?: Stripe.RefundCreateParams.Reason;
}): Promise<Stripe.Refund> {
  const latest = await stripe.paymentIntents.retrieve(params.paymentIntentId);
  if (!latest.latest_charge) throw new Error('No charge on payment intent');

  return stripe.refunds.create({
    charge: latest.latest_charge as string,
    amount: params.amountCents,
    reason: params.reason ?? 'requested_by_customer',
  });
}

/**
 * Transfère les gains du chauffeur vers son compte Connect Express.
 */
export async function transferToDriver(params: {
  amountCents: number;
  driverAccountId: string;
  rideId: string;
}): Promise<Stripe.Transfer> {
  return stripe.transfers.create({
    amount: params.amountCents,
    currency: 'eur',
    destination: params.driverAccountId,
    metadata: {
      rideId: params.rideId,
      platform: 'voyaj',
    },
  });
}

/**
 * Convertit un montant en euros vers des centimes (arrondi au centime supérieur).
 */
export function eurToCents(eur: number): number {
  return Math.round(eur * 100);
}
