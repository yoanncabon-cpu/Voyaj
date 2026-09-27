import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../shared/admin';
import { calculatePrice } from '../../shared/pricing';
import { writeAudit } from '../../shared/audit';
import { unauthenticated, invalidArgument, failedPrecondition, permissionDenied } from '../../shared/errors';

interface PublishScheduledRideParams {
  originAddress: string;
  originLat: number;
  originLng: number;
  destinationAddress: string;
  destinationLat: number;
  destinationLng: number;
  distanceKm: number;
  departureTime: string; // ISO 8601
  availableSeats: number;
  isRecurrent: boolean;
  recurrenceDays?: number[]; // 0=dim, 1=lun, ...6=sam
  detourMaxKm?: number;
  acceptsLuggage?: boolean;
  notes?: string;
}

/**
 * Callable : le chauffeur publie un trajet programmé.
 */
export const publishScheduledRide = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const data = request.data as PublishScheduledRideParams;

    // Validations
    if (!data.originAddress || !data.destinationAddress) {
      throw invalidArgument('Adresses manquantes');
    }
    if (!data.departureTime) throw invalidArgument('Date de départ manquante');
    const departure = new Date(data.departureTime);
    if (isNaN(departure.getTime())) throw invalidArgument('Date invalide');
    if (departure.getTime() < Date.now() + 30 * 60 * 1000) {
      throw invalidArgument('Le départ doit être dans au moins 30 minutes');
    }
    if (!data.availableSeats || data.availableSeats < 1 || data.availableSeats > 7) {
      throw invalidArgument('Nombre de sièges invalide (1-7)');
    }

    // Vérification du profil
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw failedPrecondition('Profil introuvable');
    const user = userDoc.data()!;
    if (!user.isDriver) throw permissionDenied('Non chauffeur');
    if (user.isSuspended) throw permissionDenied('Compte suspendu');

    // Calcul du prix
    const pricingConfig = await db.collection('config').doc('pricing').get();
    const pricing = pricingConfig.data() ?? {
      fuelPriceEurPerL: 1.85,
      defaultFuelConsumptionLper100km: 7.0,
    };

    // Récupération de la consommation du véhicule si disponible
    const vehicleSnap = await db.collection('users').doc(uid).collection('vehicle').doc('current').get();
    const vehicle = vehicleSnap.data() ?? {};
    const fuelConsumption = vehicle.fuelConsumptionLper100km ?? pricing.defaultFuelConsumptionLper100km;

    const priceBreakdown = calculatePrice({
      distanceKm: data.distanceKm,
      fuelConsumptionLper100km: fuelConsumption,
      fuelPriceEurPerL: pricing.fuelPriceEurPerL,
      seats: data.availableSeats,
    });

    const rideRef = db.collection('scheduled_rides').doc();
    const rideId = rideRef.id;
    const now = FieldValue.serverTimestamp();

    await rideRef.set({
      rideId,
      driverId: uid,
      driverName: user.firstName ?? 'Chauffeur',
      driverPhotoUrl: user.photoUrl ?? null,
      driverRating: user.rating ?? 5.0,
      vehicleDescription: vehicle.description ?? '',
      licensePlate: vehicle.licensePlate ?? '',

      originAddress: data.originAddress,
      originLat: data.originLat,
      originLng: data.originLng,
      // Geohash pour la recherche de proximité
      'g.geohash': toGeohash(data.originLat, data.originLng, 6),
      'g.geopoint': { latitude: data.originLat, longitude: data.originLng },

      destinationAddress: data.destinationAddress,
      destinationLat: data.destinationLat,
      destinationLng: data.destinationLng,

      distanceKm: data.distanceKm,
      departureTime: departure,
      availableSeats: data.availableSeats,
      bookedSeats: 0,
      isRecurrent: data.isRecurrent,
      recurrenceDays: data.recurrenceDays ?? [],
      detourMaxKm: data.detourMaxKm ?? 0,
      acceptsLuggage: data.acceptsLuggage ?? false,
      notes: data.notes ?? '',

      priceBreakdown,
      passengerTotalEur: priceBreakdown.passengerTotalEur,

      status: 'published', // published → full → cancelled → completed
      bookings: [],         // [{passengerId, bookingId, status, seats}]

      createdAt: now,
      updatedAt: now,
    });

    await writeAudit({
      action: 'scheduled.published',
      actorId: uid,
      entityType: 'scheduled_ride',
      entityId: rideId,
      metadata: { distanceKm: data.distanceKm, seats: data.availableSeats },
    });

    return { rideId, priceBreakdown };
  },
);

/** Geohash simplifié (caractères base32) - longueur 6 ≈ 1 km de précision */
function toGeohash(lat: number, lng: number, precision: number): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let hash = '';
  let bits = 0, hashValue = 0;
  let even = true;

  while (hash.length < precision) {
    if (even) {
      const midLng = (minLng + maxLng) / 2;
      if (lng > midLng) { hashValue = (hashValue << 1) + 1; minLng = midLng; }
      else { hashValue = (hashValue << 1); maxLng = midLng; }
    } else {
      const midLat = (minLat + maxLat) / 2;
      if (lat > midLat) { hashValue = (hashValue << 1) + 1; minLat = midLat; }
      else { hashValue = (hashValue << 1); maxLat = midLat; }
    }
    even = !even;
    if (++bits === 5) {
      hash += BASE32[hashValue];
      bits = 0; hashValue = 0;
    }
  }
  return hash;
}
