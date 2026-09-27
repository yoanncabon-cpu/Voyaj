/**
 * Moteur de prix Voyaj.
 *
 * Formule :
 *   costTotal = (fuelLperKm × fuelPriceEur × distanceKm) + (0.12 × distanceKm)
 *   passengerShare = costTotal / (totalSeats + 1)
 *   voyajFee = clamp(1.0 + 0.02 × distanceKm, 1.0, 4.0)
 *   passengerTotal = passengerShare + voyajFee
 *
 * fuelLperKm et fuelPriceEur sont récupérés dynamiquement depuis Remote Config
 * (ou Firestore /config/pricing pour les Cloud Functions).
 */

export interface PricingParams {
  distanceKm: number;
  fuelConsumptionLper100km: number; // ex. 6.5 pour une essence essence classique
  fuelPriceEurPerL: number;         // prix à la pompe (Remote Config)
  seats: number;                    // sièges offerts par le chauffeur
}

export interface PriceBreakdown {
  distanceKm: number;
  fuelCostEur: number;       // consommation × distance × prix
  wearCostEur: number;       // 0.12 €/km
  totalCostEur: number;      // fuelCost + wearCost
  passengerShareEur: number; // totalCost / (seats + 1)
  voyajFeeEur: number;       // 1 + 0.02/km, plafonné à 4 €
  passengerTotalEur: number; // passengerShare + voyajFee
  driverEarningsEur: number; // passengerShare (avant déduction de la commission)
}

export function calculatePrice(params: PricingParams): PriceBreakdown {
  const { distanceKm, fuelConsumptionLper100km, fuelPriceEurPerL, seats } = params;

  if (distanceKm <= 0) throw new Error('distanceKm doit être > 0');
  if (seats < 1 || seats > 7) throw new Error('seats doit être entre 1 et 7');

  const fuelLperKm = fuelConsumptionLper100km / 100;
  const fuelCostEur = fuelLperKm * fuelPriceEurPerL * distanceKm;
  const wearCostEur = 0.12 * distanceKm;
  const totalCostEur = fuelCostEur + wearCostEur;
  const passengerShareEur = totalCostEur / (seats + 1);

  const rawFee = 1.0 + 0.02 * distanceKm;
  const voyajFeeEur = Math.min(Math.max(rawFee, 1.0), 4.0);

  const passengerTotalEur = passengerShareEur + voyajFeeEur;
  const driverEarningsEur = passengerShareEur; // commission = voyajFee

  return {
    distanceKm,
    fuelCostEur: round2(fuelCostEur),
    wearCostEur: round2(wearCostEur),
    totalCostEur: round2(totalCostEur),
    passengerShareEur: round2(passengerShareEur),
    voyajFeeEur: round2(voyajFeeEur),
    passengerTotalEur: round2(passengerTotalEur),
    driverEarningsEur: round2(driverEarningsEur),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Pénalité d'annulation tardive (< 2 h) pour les trajets programmés */
export const LATE_CANCEL_PENALTY_EUR = 5.0;

/** Code de prise en charge : 4 chiffres aléatoires */
export function generatePickupCode(): string {
  const digits = Math.floor(Math.random() * 9000) + 1000;
  return digits.toString();
}
