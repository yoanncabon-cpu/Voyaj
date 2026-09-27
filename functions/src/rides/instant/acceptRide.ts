import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../shared/admin';
import { createRidePaymentIntent, eurToCents } from '../../shared/stripe';
import { sendPushNotification } from '../../shared/fcm';
import { generatePickupCode } from '../../shared/pricing';
import { writeAudit } from '../../shared/audit';
import {
  unauthenticated, notFound, failedPrecondition, permissionDenied,
} from '../../shared/errors';

interface AcceptRideParams {
  rideId: string;
}

/**
 * Callable : le chauffeur accepte une demande de course.
 * 1. Vérifie que la course est en status 'searching'.
 * 2. Autorisation du paiement (Stripe capture_method: 'manual').
 * 3. Met à jour la course avec status: 'accepted' + données du chauffeur.
 * 4. Notifie le passager.
 * Transaction Firestore pour éviter la double-acceptation.
 */
export const acceptRide = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const driverUid = request.auth.uid;
    const { rideId } = request.data as AcceptRideParams;
    if (!rideId) throw failedPrecondition('rideId manquant');

    const rideRef = db.collection('rides').doc(rideId);

    // Récupération du profil chauffeur
    const driverDoc = await db.collection('users').doc(driverUid).get();
    if (!driverDoc.exists) throw notFound('Profil chauffeur introuvable');
    const driver = driverDoc.data()!;
    if (!driver.isDriver) throw permissionDenied('Non chauffeur');
    if (driver.isSuspended) throw permissionDenied('Compte suspendu');

    // Récupération du véhicule
    const vehicleSnap = await db
      .collection('users').doc(driverUid)
      .collection('vehicle').doc('current').get();
    const vehicle = vehicleSnap.data() ?? {};

    let pickupCode = '';
    let stripePaymentIntentId = '';

    await db.runTransaction(async (tx) => {
      const rideSnap = await tx.get(rideRef);
      if (!rideSnap.exists) throw notFound('Course introuvable');

      const ride = rideSnap.data()!;
      if (ride.status !== 'searching') {
        throw failedPrecondition(`Course déjà ${ride.status}`);
      }

      // Autorisation Stripe
      const pi = await createRidePaymentIntent({
        amountCents: eurToCents(ride.priceBreakdown.passengerTotalEur),
        currency: 'eur',
        paymentMethodId: ride.paymentMethodId,
        rideId,
        driverStripeAccountId: driver.stripeAccountId,
      });
      stripePaymentIntentId = pi.id;

      pickupCode = generatePickupCode();

      const now = FieldValue.serverTimestamp();
      tx.update(rideRef, {
        status: 'accepted',
        driverId: driverUid,
        driverName: driver.firstName ?? 'Chauffeur',
        driverPhotoUrl: driver.photoUrl ?? null,
        driverRating: driver.rating ?? 5.0,
        driverLat: driver.lastLat ?? null,
        driverLng: driver.lastLng ?? null,
        vehicleDescription: vehicle.description ?? '',
        licensePlate: vehicle.licensePlate ?? '',
        vehicleColor: vehicle.color ?? '',
        pickupCode,
        stripePaymentIntentId,
        acceptedAt: now,
        updatedAt: now,
      });
    });

    // Notifier le passager
    const rideDoc = await rideRef.get();
    const ride = rideDoc.data()!;
    const passengerDoc = await db.collection('users').doc(ride.passengerId).get();
    const passenger = passengerDoc.data();
    if (passenger?.fcmToken) {
      await sendPushNotification({
        fcmTokens: [passenger.fcmToken],
        title: 'Chauffeur trouvé !',
        body: `${driver.firstName} est en route`,
        data: { type: 'ride_accepted', rideId },
        route: `/ride/$rideId`,
      });
    }

    await writeAudit({
      action: 'ride.accepted',
      actorId: driverUid,
      entityType: 'ride',
      entityId: rideId,
      metadata: { stripePaymentIntentId },
    });

    await writeAudit({
      action: 'payment.authorized',
      actorId: driverUid,
      entityType: 'ride',
      entityId: rideId,
      metadata: { stripePaymentIntentId },
    });

    return { success: true, pickupCode };
  },
);
