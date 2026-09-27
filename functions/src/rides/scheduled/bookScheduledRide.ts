import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../shared/admin';
import {
  unauthenticated, notFound, failedPrecondition, invalidArgument, permissionDenied,
  alreadyExists,
} from '../../shared/errors';
import { writeAudit } from '../../shared/audit';
import { createRidePaymentIntent, eurToCents } from '../../shared/stripe';
import { sendPushNotification } from '../../shared/fcm';
import { generatePickupCode } from '../../shared/pricing';

interface BookScheduledRideParams {
  rideId: string;
  seats: number;
  paymentMethodId: string;
}

/**
 * Callable : réserve des places sur un trajet programmé et autorise le paiement.
 * Le paiement est capturé après confirmation de la course (J-1 ou auto).
 */
export const bookScheduledRide = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const { rideId, seats, paymentMethodId } =
      request.data as BookScheduledRideParams;

    if (!rideId) throw invalidArgument('rideId requis');
    if (!seats || seats < 1) throw invalidArgument('seats doit être >= 1');
    if (!paymentMethodId) throw invalidArgument('paymentMethodId requis');

    const rideRef = db.collection('scheduled_rides').doc(rideId);
    const rideSnap = await rideRef.get();
    if (!rideSnap.exists) throw notFound('Trajet introuvable');

    const ride = rideSnap.data()!;

    if (ride.driverId === uid) throw permissionDenied('Le chauffeur ne peut pas réserver son propre trajet');

    if (ride.status !== 'published') {
      throw failedPrecondition(`Trajet non disponible (statut: ${ride.status})`);
    }

    const availableSeats: number = (ride.seats ?? 0) - (ride.bookedSeats ?? 0);
    if (seats > availableSeats) {
      throw failedPrecondition(`Seulement ${availableSeats} place(s) disponible(s)`);
    }

    // Vérifier pas de double réservation
    const existingBooking = await db.collection('scheduled_bookings')
      .where('rideId', '==', rideId)
      .where('passengerId', '==', uid)
      .where('status', 'in', ['confirmed', 'pending_payment'])
      .limit(1)
      .get();

    if (!existingBooking.empty) {
      throw alreadyExists('Vous avez déjà réservé ce trajet');
    }

    // Vérification utilisateur
    const userSnap = await db.collection('users').doc(uid).get();
    const user = userSnap.data();
    if (!user) throw notFound('Utilisateur introuvable');
    if (user.isSuspended) throw permissionDenied('Compte suspendu');

    // Prix par passager
    const priceBreakdown = ride.priceBreakdown;
    if (!priceBreakdown) throw failedPrecondition('Tarif non défini sur ce trajet');

    const amountCents = eurToCents(priceBreakdown.passengerTotalEur * seats);

    // Autorisation Stripe (capture manuelle à J)
    const paymentIntent = await createRidePaymentIntent({
      amountCents,
      currency: 'eur',
      customerId: user.stripeCustomerId,
      paymentMethodId,
      rideId,
    });

    const pickupCode = generatePickupCode();
    const now = FieldValue.serverTimestamp();

    // Créer la réservation
    const bookingRef = await db.collection('scheduled_bookings').add({
      rideId,
      passengerId: uid,
      driverId: ride.driverId,
      seats,
      pickupCode,
      status: 'confirmed',
      priceBreakdown: {
        ...priceBreakdown,
        totalForBooking: priceBreakdown.passengerTotalEur * seats,
      },
      stripePaymentIntentId: paymentIntent.id,
      createdAt: now,
      updatedAt: now,
    });

    // Mettre à jour les places réservées
    await rideRef.update({
      bookedSeats: FieldValue.increment(seats),
      updatedAt: now,
    });

    // Notifier le chauffeur
    const driverSnap = await db.collection('users').doc(ride.driverId).get();
    const driver = driverSnap.data();
    if (driver?.fcmToken) {
      await sendPushNotification({
        fcmTokens: [driver.fcmToken],
        title: 'Nouvelle réservation',
        body: `${user.displayName ?? 'Un passager'} a réservé ${seats} place(s)`,
        data: { type: 'scheduled_booked', rideId, bookingId: bookingRef.id },
      });
    }

    await writeAudit({
      action: 'scheduled.booked',
      actorId: uid,
      entityType: 'scheduled_ride',
      entityId: rideId,
      metadata: { bookingId: bookingRef.id, seats, paymentIntentId: paymentIntent.id },
    });

    return {
      success: true,
      bookingId: bookingRef.id,
      pickupCode,
    };
  },
);
