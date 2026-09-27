import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { PriceBreakdown } from '@/lib/types';

/** Erreur renvoyée par une Edge Function, avec un message lisible (français). */
export class ApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

/** Appelle une Edge Function Voyaj. Toute logique sensible (argent, statuts) passe par ici. */
export async function call<T = unknown>(fn: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new ApiError(payload?.message ?? 'Une erreur est survenue', payload?.error);
    }
    throw new ApiError('Connexion impossible. Vérifiez votre réseau.');
  }
  return data as T;
}

export interface Place {
  lat: number;
  lng: number;
  address: string;
}

export interface PaymentSheetParams {
  paymentIntentClientSecret: string;
  ephemeralKey: string;
  customerId: string;
}

export const api = {
  priceEstimate: (pickup: Place, dest: Place) =>
    call<{ distanceKm: number; price: PriceBreakdown }>('price-estimate', { pickup, dest }),

  requestRide: (pickup: Place, dest: Place) =>
    call<{ rideId: string; price: PriceBreakdown; distanceKm: number } & PaymentSheetParams>('ride-request', { pickup, dest }),
  confirmRidePayment: (rideId: string) =>
    call<{ status: string; driversNotified?: number }>('ride-confirm-payment', { rideId }),
  acceptRide: (rideId: string) => call<{ status: string }>('ride-accept', { rideId }),
  rideAction: (rideId: string, action: 'arrive' | 'start' | 'end' | 'confirm' | 'cancel' | 'report_absent', extra: Record<string, unknown> = {}) =>
    call<{ status?: string; penaltyEur?: number }>('ride-status', { rideId, action, ...extra }),
  rate: (rideId: string, kind: 'instant' | 'scheduled', score: number, comment?: string, ratedUserId?: string) =>
    call('ride-rate', { rideId, kind, score, comment, ratedUserId }),

  publishScheduled: (p: { origin: Place; dest: Place; departureAt: string; seats: number; recurringDaily: boolean }) =>
    call<{ scheduledRideId: string; price: PriceBreakdown }>('scheduled-publish', p),
  book: (scheduledRideId: string, seats: number) =>
    call<{ bookingId: string; amountEur: number } & PaymentSheetParams>('scheduled-book', { scheduledRideId, seats }),
  confirmBooking: (bookingId: string) => call<{ status: string; pickupCode: string }>('scheduled-book-confirm', { bookingId }),
  cancelBooking: (bookingId: string) => call<{ penaltyEur: number; refundedEur: number }>('scheduled-cancel', { bookingId }),
  cancelScheduled: (scheduledRideId: string) => call<{ refunded: number }>('scheduled-cancel', { scheduledRideId }),

  dispute: (rideId: string, kind: 'instant' | 'scheduled', reason: string, description: string) =>
    call<{ disputeId: string }>('dispute-create', { rideId, kind, reason, description }),
  stripeConnect: () => call<{ url: string; onboarded: boolean; payoutsEnabled: boolean }>('stripe-connect', { returnUrl: 'voyaj://profile/payment' }),
  redeem: (rewardId: string) => call<{ code: string; title: string }>('points-redeem', { rewardId }),
  saveVehicle: (v: { make: string; model: string; plate: string; color?: string; vehicleType: string; seats: number }) =>
    call<{ plate: string }>('vehicle-save', v),
  submitVerification: () => call<{ status: string }>('verification-submit'),
  deleteAccount: () => call('account-delete'),
  safeReturn: (action: 'start' | 'update' | 'arrived' | 'status', extra: Record<string, unknown> = {}) =>
    call<{ url?: string; expiresAt?: string; active?: boolean }>('safe-return', { action, ...extra }),
};
