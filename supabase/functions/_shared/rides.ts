// Logique de fin de course partagée par ride-status (confirmation du passager)
// et maintenance (confirmation d'office après 24 h).
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { Row } from './http.ts';
import { audit, awardPoints, POINTS } from './domain.ts';
import { toCents } from './pricing.ts';
import { chargeOf, releaseOrRefund, stripe, transferToDriver } from './stripe.ts';
import { pushToUsers } from './push.ts';

/**
 * Encaisse le paiement autorisé, reverse la part du chauffeur, attribue les points.
 * Idempotent : ne fait rien si la course est déjà confirmée.
 */
export async function completeInstantRide(db: SupabaseClient, ride: Row, auto: boolean): Promise<boolean> {
  const { data: claimed } = await db.from('rides')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', ride.id).eq('status', 'ended')
    .select('id').maybeSingle();
  if (!claimed) return false;

  let transferId: string | null = null;
  if (ride.stripe_payment_intent_id) {
    const pi = await stripe.paymentIntents.retrieve(ride.stripe_payment_intent_id);
    if (pi.status === 'requires_capture') {
      await stripe.paymentIntents.capture(pi.id, {}, { idempotencyKey: `capture-${ride.id}` });
    }
    transferId = await transferToDriver(db, {
      driverId: ride.driver_id,
      amountCents: toCents(ride.price.driverEarningsEur),
      entityId: ride.id,
      sourceTransaction: await chargeOf(pi.id),
    });
    if (transferId) await db.from('rides').update({ stripe_transfer_id: transferId }).eq('id', ride.id);
  }

  await Promise.all([
    db.rpc('increment_rides', { uid: ride.passenger_id }),
    db.rpc('increment_rides', { uid: ride.driver_id }),
    awardPoints(db, ride.passenger_id, POINTS.rideCompletedPassenger, 'ride_completed', ride.id),
    awardPoints(db, ride.driver_id, POINTS.rideCompletedDriver, 'ride_completed', ride.id),
  ]);

  await pushToUsers(db, [ride.driver_id], {
    title: 'Course confirmée',
    body: `${Number(ride.price.driverEarningsEur).toFixed(2)} € arrivent sur votre compte.`,
    route: `/ride/summary/${ride.id}`,
  });
  await audit(db, {
    action: auto ? 'ride.auto_confirmed' : 'ride.confirmed',
    actorId: auto ? null : ride.passenger_id,
    entityType: 'ride', entityId: ride.id,
    metadata: { transferId },
  });
  return true;
}

/**
 * Annule une course et règle l'argent :
 *   - penaltyEur = 0 → l'autorisation est libérée intégralement
 *   - penaltyEur > 0 → seule la pénalité est encaissée et reversée au chauffeur
 */
export async function cancelInstantRide(db: SupabaseClient, ride: Row, params: {
  by: string | null;
  reason: string;
  penaltyEur: number;
  finalStatus?: 'cancelled' | 'expired' | 'passenger_absent';
}): Promise<boolean> {
  const status = params.finalStatus ?? 'cancelled';
  const { data: claimed } = await db.from('rides')
    .update({
      status,
      cancelled_by: params.by,
      cancel_reason: params.reason,
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', ride.id).eq('status', ride.status)
    .select('id').maybeSingle();
  if (!claimed) return false;

  if (ride.stripe_payment_intent_id) {
    const pi = await stripe.paymentIntents.retrieve(ride.stripe_payment_intent_id);
    const penaltyCents = Math.min(toCents(params.penaltyEur), pi.amount_capturable || pi.amount);
    if (penaltyCents > 0 && pi.status === 'requires_capture') {
      await stripe.paymentIntents.capture(pi.id, { amount_to_capture: penaltyCents }, { idempotencyKey: `penalty-${ride.id}` });
      if (ride.driver_id) {
        await transferToDriver(db, {
          driverId: ride.driver_id,
          amountCents: penaltyCents,
          entityId: `${ride.id}-penalty`,
          sourceTransaction: await chargeOf(pi.id),
        });
      }
      await audit(db, {
        action: 'payment.penalty', actorId: params.by, entityType: 'ride', entityId: ride.id,
        metadata: { penaltyEur: penaltyCents / 100, reason: params.reason },
      });
    } else {
      await releaseOrRefund(pi.id);
    }
  }

  await audit(db, {
    action: `ride.${status}`, actorId: params.by, entityType: 'ride', entityId: ride.id,
    metadata: { reason: params.reason, previousStatus: ride.status },
  });
  return true;
}

export async function notifyParticipants(db: SupabaseClient, ride: Row, exclude: string | null, title: string, body: string) {
  const targets = [ride.passenger_id, ride.driver_id].filter((id) => id && id !== exclude);
  await pushToUsers(db, targets, { title, body, route: `/ride/${ride.id}`, data: { type: 'ride_update', rideId: ride.id } });
}
