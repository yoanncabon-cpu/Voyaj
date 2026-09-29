import type { PaymentSheetParams } from '@/lib/api';

export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

// Aperçu web uniquement : le paiement Stripe natif n'existe que sur téléphone.
export async function pay(_params: PaymentSheetParams, _name?: string | null): Promise<boolean> {
  throw new Error("Le paiement n'est disponible que dans l'application mobile.");
}
