import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import type { PaymentSheetParams } from '@/lib/api';

export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

/**
 * Affiche la feuille de paiement Stripe (carte, Apple Pay/Google Pay plus tard).
 * Renvoie true si le paiement / l'autorisation a abouti, false si annulé.
 * Lève une erreur lisible sinon.
 */
export async function pay(params: PaymentSheetParams, name?: string | null): Promise<boolean> {
  const init = await initPaymentSheet({
    merchantDisplayName: 'Voyaj',
    customerId: params.customerId,
    customerEphemeralKeySecret: params.ephemeralKey,
    paymentIntentClientSecret: params.paymentIntentClientSecret,
    allowsDelayedPaymentMethods: false,
    returnURL: 'voyaj://stripe-redirect',
    defaultBillingDetails: name ? { name } : undefined,
  });
  if (init.error) throw new Error(init.error.message);

  const result = await presentPaymentSheet();
  if (result.error) {
    if (result.error.code === 'Canceled') return false;
    throw new Error(result.error.message);
  }
  return true;
}
