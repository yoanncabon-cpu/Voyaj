import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../shared/admin';
import { sendRideRequestNotification } from '../../shared/fcm';
import { calculatePrice } from '../../shared/pricing';
import { writeAudit } from '../../shared/audit';
import { invalidArgument, failedPrecondition, unauthenticated } from '../../shared/errors';

interface RequestRideParams {
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  destinationLat: number;
  destinationLng: number;
  destinationAddress: string;
  distanceKm: number;
  paymentMethodId: string;
}

/**
 * Callable : le passager demande une course immédiate.
 * 1. Vérifie le profil et la méthode de paiement.
 * 2. Recherche les chauffeurs en ligne à < 10 km (geohash).
 * 3. Crée le document /rides/{rideId} avec status: 'searching'.
 * 4. Envoie la notification FCM aux chauffeurs trouvés.
 * 5. Planifie un Cloud Task pour l'expiration à 90 s (géré séparément).
 */
export const requestRide = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const data = request.data as RequestRideParams;

    // Validation basique
    if (!data.pickupAddress || !data.destinationAddress) {
      throw invalidArgument('Adresses manquantes');
    }
    if (!data.distanceKm || data.distanceKm <= 0) {
      throw invalidArgument('Distance invalide');
    }
    if (!data.paymentMethodId) {
      throw invalidArgument('Méthode de paiement manquante');
    }

    // Vérification du profil passager
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw failedPrecondition('Profil introuvable');

    const userData = userDoc.data()!;
    if (userData.isSuspended) {
      throw new HttpsError('permission-denied', 'Compte suspendu');
    }

    // Récupération des paramètres de prix depuis /config/pricing
    const pricingConfig = await db.collection('config').doc('pricing').get();
    const pricing = pricingConfig.data() ?? {
      fuelPriceEurPerL: 1.85,
      defaultFuelConsumptionLper100km: 7.0,
    };

    const priceBreakdown = calculatePrice({
      distanceKm: data.distanceKm,
      fuelConsumptionLper100km: pricing.defaultFuelConsumptionLper100km,
      fuelPriceEurPerL: pricing.fuelPriceEurPerL,
      seats: 1, // course immédiate = 1 passager
    });

    // Création du document de course
    const rideRef = db.collection('rides').doc();
    const rideId = rideRef.id;

    const now = FieldValue.serverTimestamp();
    await rideRef.set({
      rideId,
      passengerId: uid,
      passengerName: userData.firstName ?? 'Passager',
      passengerPhotoUrl: userData.photoUrl ?? null,
      passengerRating: userData.rating ?? 5.0,
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      pickupAddress: data.pickupAddress,
      destinationLat: data.destinationLat,
      destinationLng: data.destinationLng,
      destinationAddress: data.destinationAddress,
      distanceKm: data.distanceKm,
      priceBreakdown,
      paymentMethodId: data.paymentMethodId,
      status: 'searching', // searching → accepted → pickup → in_progress → ended → confirmed
      createdAt: now,
      updatedAt: now,
      // Champs remplis à l'acceptation :
      driverId: null,
      driverName: null,
      driverPhotoUrl: null,
      driverRating: null,
      vehicleDescription: null,
      licensePlate: null,
      pickupCode: null,
      stripePaymentIntentId: null,
      acceptedAt: null,
      arrivedAt: null,
      startedAt: null,
      endedAt: null,
      confirmedAt: null,
    });

    // Recherche des chauffeurs en ligne via geohash
    // (La logique geohash complète sera dans un module dédié)
    // Pour l'instant : requête simplifiée sur les chauffeurs en ligne
    const driversSnapshot = await db
      .collection('users')
      .where('isOnline', '==', true)
      .where('isDriver', '==', true)
      .where('isSuspended', '==', false)
      .limit(20)
      .get();

    const fcmTokens: string[] = [];
    for (const driverDoc of driversSnapshot.docs) {
      const driver = driverDoc.data();
      if (driver.fcmToken) fcmTokens.push(driver.fcmToken);
    }

    // Envoi des notifications
    if (fcmTokens.length > 0) {
      await sendRideRequestNotification({
        fcmTokens,
        rideId,
        passengerName: userData.firstName ?? 'Passager',
        pickupAddress: data.pickupAddress,
        distanceKm: data.distanceKm,
        priceEur: priceBreakdown.passengerTotalEur,
      });
    }

    await writeAudit({
      action: 'ride.created',
      actorId: uid,
      entityType: 'ride',
      entityId: rideId,
      metadata: {
        distanceKm: data.distanceKm,
        priceEur: priceBreakdown.passengerTotalEur,
        driversNotified: fcmTokens.length,
      },
    });

    return { rideId, priceBreakdown, driversNotified: fcmTokens.length };
  },
);
