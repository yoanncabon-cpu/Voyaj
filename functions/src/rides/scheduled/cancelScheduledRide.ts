import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../shared/admin';
import {
  unauthenticated, notFound, failedPrecondition, invalidArgument, permissionDenied,
} from '../../shared/errors';
import { writeAudit } from '../../shared/audit';
import { refundPaymentIntent, eurToCents, capturePaymentIntent } from '../../shared/stripe';
import { sendPushNotification } from '../../shared/fcm';
import { LATE_CANCEL_PENALTY_EUR } from '../../shared/pricing';

interface CancelScheduledRideParams {
  bookingId?: string;  // si passager annule sa réservation
  rideId?: string;     // si chauffeur annule son trajet
}

/**
 * Callable : annule une réservation (passager) ou un trajet entier (chauffeur).
 *
 * Politique d'annulation :
 *   - Passager, > 2h avant départ → remboursement total
 *   - Passager, < 2h avant départ → pénalité 5 € (retenue)
 *   - Chauffeur annule son trajet → remboursement total de tous les passagers
 */
export const cancelScheduledRide = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const { bookingId, rideId } = request.data as CancelScheduledRideParams;

    if (!bookingId && !rideId) throw invalidArgument('bookingId ou rideId requis');

    if (bookingId) {
      return cancelPassengerBooking(uid, bookingId);
    } else {
      return cancelDriverRide(uid, rideId!);
    }
  },
);

// ── Annulation d'une réservation passager ─────────────────────────────────────
async function cancelPassengerBooking(uid: string, bookingId: string) {
  const bookingRef = db.collection('scheduled_bookings').doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) throw notFound('Réservation introuvable');

  const booking = bookingSnap.data()!;
  if (booking.passengerId !== uid) throw permissionDenied('Non autorisé');

  if (!['confirmed', 'pending_payment'].includes(booking.status)) {
    throw failedPrecondition(`Réservation non annulable (statut: ${booking.status})`);
  }

  // Vérifier l'heure de départ du trajet
  const rideSnap = await db.collection('scheduled_rides').doc(booking.rideId).get();
  const ride = rideSnap.data() ?? {};
  const departureMs: number = ride.departureAt?.toMillis?.() ?? 0;
  const hoursUntilDeparture = (departureMs - Date.now()) / (1000 * 3600);

  const isLateCancel = hoursUntilDeparture < 2;
  const penaltyEur = isLateCancel ? LATE_CANCEL_PENALTY_EUR : 0;

  const now = FieldValue.serverTimestamp();

  // Remboursement Stripe
  if (booking.stripePaymentIntentId) {
    const penaltyCents = eurToCents(penaltyEur);
    const totalCents = eurToCents(
      booking.priceBreakdown?.totalForBooking ?? booking.priceBreakdown?.passengerTotalEur ?? 0,
    );
    const refundCents = Math.max(totalCents - penaltyCents, 0);

    if (refundCents > 0) {
      await refundPaymentIntent({
        paymentIntentId: booking.stripePaymentIntentId,
        amountCents: refundCents,
        reason: 'requested_by_customer',
      });
    }

    if (penaltyCents > 0) {
      // Capturer uniquement la pénalité
      await capturePaymentIntent(booking.stripePaymentIntentId);
      await writeAudit({
        action: 'payment.penalty',
        actorId: uid,
        entityType: 'scheduled_booking',
        entityId: bookingId,
        metadata: { penaltyEur, reason: 'late_cancel_passenger' },
      });
    }
  }

  // Libérer les places
  await db.collection('scheduled_rides').doc(booking.rideId).update({
    bookedSeats: FieldValue.increment(-booking.seats),
    updatedAt: now,
  });

  await bookingRef.update({
    status: 'cancelled',
    cancelledAt: now,
    cancelledBy: uid,
    penaltyApplied: penaltyEur > 0,
    updatedAt: now,
  });

  // Notifier le chauffeur
  const driverSnap = await db.collection('users').doc(booking.driverId).get();
  const driver = driverSnap.data();
  if (driver?.fcmToken) {
    await sendPushNotification({
      fcmTokens: [driver.fcmToken],
      title: 'Réservation annulée',
      body: 'Un passager a annulé sa réservation',
      data: { type: 'booking_cancelled', rideId: booking.rideId, bookingId },
    });
  }

  await writeAudit({
    action: 'scheduled.cancelled',
    actorId: uid,
    entityType: 'scheduled_booking',
    entityId: bookingId,
    metadata: { isLateCancel, penaltyEur },
  });

  return { success: true, penaltyApplied: penaltyEur > 0, penaltyEur };
}

// ── Annulation du trajet par le chauffeur ─────────────────────────────────────
async function cancelDriverRide(uid: string, rideId: string) {
  const rideRef = db.collection('scheduled_rides').doc(rideId);
  const rideSnap = await rideRef.get();
  if (!rideSnap.exists) throw notFound('Trajet introuvable');

  const ride = rideSnap.data()!;
  if (ride.driverId !== uid) throw permissionDenied('Réservé au chauffeur');

  if (!['published', 'confirmed'].includes(ride.status)) {
    throw failedPrecondition(`Trajet non annulable (statut: ${ride.status})`);
  }

  const now = FieldValue.serverTimestamp();

  // Récupérer toutes les réservations actives
  const bookingsSnap = await db.collection('scheduled_bookings')
    .where('rideId', '==', rideId)
    .where('status', 'in', ['confirmed', 'pending_payment'])
    .get();

  // Rembourser tous les passagers
  const refundPromises = bookingsSnap.docs.map(async (bookingDoc) => {
    const booking = bookingDoc.data();
    if (booking.stripePaymentIntentId) {
      try {
        await refundPaymentIntent({
          paymentIntentId: booking.stripePaymentIntentId,
          reason: 'requested_by_customer',
        });
      } catch (e) {
        console.error(`Refund failed for booking ${bookingDoc.id}:`, e);
      }
    }

    await bookingDoc.ref.update({
      status: 'cancelled',
      cancelledAt: now,
      cancelledBy: uid,
      cancelReason: 'driver_cancelled',
      updatedAt: now,
    });

    // Notifier chaque passager
    const passengerSnap = await db.collection('users').doc(booking.passengerId).get();
    const passenger = passengerSnap.data();
    if (passenger?.fcmToken) {
      await sendPushNotification({
        fcmTokens: [passenger.fcmToken],
        title: 'Trajet annulé',
        body: 'Le chauffeur a annulé le trajet. Vous serez remboursé(e).',
        data: { type: 'ride_cancelled_by_driver', rideId, bookingId: bookingDoc.id },
      });
    }
  });

  await Promise.allSettled(refundPromises);

  // Annuler le trajet
  await rideRef.update({
    status: 'cancelled',
    cancelledAt: now,
    cancelledBy: uid,
    updatedAt: now,
  });

  await writeAudit({
    action: 'scheduled.cancelled',
    actorId: uid,
    entityType: 'scheduled_ride',
    entityId: rideId,
    metadata: { bookingsCancelled: bookingsSnap.size },
  });

  return { success: true, bookingsCancelled: bookingsSnap.size };
}
