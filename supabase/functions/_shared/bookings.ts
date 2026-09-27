// Cycle de vie d'une réservation de trajet programmé.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { Row } from './http.ts';
import { audit, awardPoints, POINTS } from './domain.ts';
import { round2, toCents } from './pricing.ts';
import { chargeOf, releaseOrRefund, stripe, transferToDriver } from './stripe.ts';
import { pushToUsers } from './push.ts';

/** Confirme une réservation si Stripe indique le paiement réussi. Idempotent. */
export async function confirmBooking(db: SupabaseClient, booking: Row): Promise<boolean> {
  if (!booking.stripe_payment_intent_id) return false;
  const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id);
  if (pi.status !== 'succeeded') return false;

  const { data: claimed } = await db.from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', booking.id).eq('status', 'pending_payment')
    .select('id').maybeSingle();
  if (!claimed) return true; // déjà confirmée

  const { data: sr } = await db.from('scheduled_rides').select('driver_id, origin_address, dest_address, departure_at')
    .eq('id', booking.scheduled_ride_id).single();
  const { data: passenger } = await db.from('profiles').select('name').eq('id', booking.passenger_id).single();
  if (sr) {
    await pushToUsers(db, [sr.driver_id], {
      title: 'Nouvelle réservation',
      body: `${passenger?.name ?? 'Un passager'} a réservé ${booking.seats} place(s) · ${sr.origin_address} → ${sr.dest_address}`,
      route: `/scheduled/${booking.scheduled_ride_id}`,
    });
  }
  await audit(db, {
    action: 'scheduled.booked', actorId: booking.passenger_id, entityType: 'booking', entityId: booking.id,
    metadata: { paymentIntentId: pi.id, amountEur: booking.amount_eur },
  });
  return true;
}

/**
 * Annulation par le passager :
 *   > 2 h avant le départ → remboursement total
 *   < 2 h avant le départ → pénalité (config, 5 € par défaut) retenue et reversée au chauffeur
 */
export async function cancelBookingByPassenger(db: SupabaseClient, booking: Row, departureAt: string, penaltyEurConfig: number) {
  const hoursLeft = (new Date(departureAt).getTime() - Date.now()) / 3_600_000;
  const amount = Number(booking.amount_eur);
  const penaltyEur = booking.status === 'confirmed' && hoursLeft < 2 ? Math.min(penaltyEurConfig, amount) : 0;

  const { data: claimed } = await db.from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), penalty_eur: penaltyEur })
    .eq('id', booking.id).in('status', ['pending_payment', 'confirmed'])
    .select('id').maybeSingle();
  if (!claimed) return { penaltyEur: 0, refundedEur: 0 };

  await db.rpc('release_seats', { ride: booking.scheduled_ride_id, n: booking.seats });

  let refundedEur = 0;
  if (booking.stripe_payment_intent_id) {
    if (booking.status === 'confirmed') {
      refundedEur = round2(amount - penaltyEur);
      if (refundedEur > 0) await releaseOrRefund(booking.stripe_payment_intent_id, toCents(refundedEur));
      if (penaltyEur > 0) {
        const { data: sr } = await db.from('scheduled_rides').select('driver_id').eq('id', booking.scheduled_ride_id).single();
        if (sr) {
          await transferToDriver(db, {
            driverId: sr.driver_id, amountCents: toCents(penaltyEur), entityId: `${booking.id}-penalty`,
            sourceTransaction: await chargeOf(booking.stripe_payment_intent_id),
          });
        }
      }
    } else {
      await releaseOrRefund(booking.stripe_payment_intent_id);
    }
  }
  await audit(db, {
    action: 'scheduled.cancelled', actorId: booking.passenger_id, entityType: 'booking', entityId: booking.id,
    metadata: { penaltyEur, refundedEur, hoursLeft: round2(hoursLeft) },
  });
  return { penaltyEur, refundedEur };
}

/** Le chauffeur annule : tous les passagers sont remboursés intégralement. */
export async function refundBookingFully(db: SupabaseClient, booking: Row, reason: string): Promise<boolean> {
  const { data: claimed } = await db.from('bookings')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', booking.id).in('status', ['pending_payment', 'confirmed'])
    .select('id').maybeSingle();
  if (!claimed) return false;
  if (booking.stripe_payment_intent_id) {
    await releaseOrRefund(booking.stripe_payment_intent_id).catch((e) => console.error('refund', booking.id, e));
  }
  await audit(db, { action: 'scheduled.refunded', actorId: null, entityType: 'booking', entityId: booking.id, metadata: { reason } });
  return true;
}

/**
 * Trajet effectué (départ passé de 24 h, sans litige ouvert) :
 * la part du chauffeur est virée, points attribués.
 */
export async function completeBooking(db: SupabaseClient, booking: Row, sr: Row) {
  const { data: claimed } = await db.from('bookings')
    .update({ status: 'completed' })
    .eq('id', booking.id).eq('status', 'confirmed')
    .select('id').maybeSingle();
  if (!claimed) return;

  const earnings = round2(Number(sr.price.driverEarningsEur) * booking.seats);
  const transferId = booking.stripe_payment_intent_id
    ? await transferToDriver(db, {
      driverId: sr.driver_id, amountCents: toCents(earnings), entityId: booking.id,
      sourceTransaction: await chargeOf(booking.stripe_payment_intent_id),
    })
    : null;
  if (transferId) await db.from('bookings').update({ stripe_transfer_id: transferId }).eq('id', booking.id);

  await Promise.all([
    db.rpc('increment_rides', { uid: booking.passenger_id }),
    awardPoints(db, booking.passenger_id, POINTS.rideCompletedPassenger, 'ride_completed', booking.id),
    awardPoints(db, sr.driver_id, POINTS.rideCompletedDriver, 'ride_completed', booking.id),
  ]);
  await audit(db, { action: 'scheduled.completed', actorId: null, entityType: 'booking', entityId: booking.id, metadata: { transferId, earnings } });
}
