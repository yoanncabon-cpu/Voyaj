import { onCall } from 'firebase-functions/v2/https';
import { db } from '../shared/admin';
import { invalidArgument, unauthenticated } from '../shared/errors';
import { calculatePrice, PriceBreakdown } from '../shared/pricing';

interface CalculatePriceParams {
  distanceKm: number;
  seats: number;
  vehicleType?: 'citadine' | 'berline' | 'suv' | 'break' | 'utilitaire';
}

// Consommation par défaut selon type de véhicule (L/100 km)
const DEFAULT_CONSUMPTION: Record<string, number> = {
  citadine: 5.5,
  berline: 6.5,
  suv: 8.0,
  break: 7.0,
  utilitaire: 10.0,
};

/**
 * Callable : calcule le prix estimé d'une course.
 * Lit la config de prix depuis Firestore /config/pricing (carburant à jour).
 */
export const calculateRidePrice = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const { distanceKm, seats, vehicleType = 'berline' } =
      request.data as CalculatePriceParams;

    if (!distanceKm || distanceKm <= 0) throw invalidArgument('distanceKm doit être > 0');
    if (!seats || seats < 1 || seats > 7) throw invalidArgument('seats doit être entre 1 et 7');

    // Lire les paramètres de prix depuis Firestore
    const configSnap = await db.collection('config').doc('pricing').get();
    const config = configSnap.data() ?? {};

    const fuelPriceEurPerL: number = config.fuelPriceEurPerL ?? 1.85;
    const fuelConsumptionLper100km: number =
      config[`consumption_${vehicleType}`] ??
      DEFAULT_CONSUMPTION[vehicleType] ??
      6.5;

    const breakdown: PriceBreakdown = calculatePrice({
      distanceKm,
      fuelConsumptionLper100km,
      fuelPriceEurPerL,
      seats,
    });

    return { breakdown };
  },
);
