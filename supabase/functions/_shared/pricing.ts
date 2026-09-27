/**
 * Moteur de prix Voyaj (partage de frais, jamais de bénéfice pour le chauffeur).
 *
 *   coût total      = carburant (conso × prix × km) + usure (0,12 €/km)
 *   part passager   = coût total / (places passagers + 1)   ← le chauffeur paie sa part
 *   frais Voyaj     = 1 € + 0,02 €/km, plafonné à 4 €
 *   total passager  = part passager + frais Voyaj
 *   gain chauffeur  = part passager
 *
 * Fonctions pures, sans dépendance réseau : testées par pricing.test.ts.
 */

export interface PricingConfig {
  fuelPriceEurPerL: number;
  wearEurPerKm: number;
  feeBaseEur: number;
  feePerKmEur: number;
  feeMaxEur: number;
}

export interface PriceBreakdown {
  distanceKm: number;
  fuelCostEur: number;
  wearCostEur: number;
  totalCostEur: number;
  passengerShareEur: number;
  voyajFeeEur: number;
  passengerTotalEur: number;
  driverEarningsEur: number;
}

export const DEFAULT_CONFIG: PricingConfig = {
  fuelPriceEurPerL: 1.85,
  wearEurPerKm: 0.12,
  feeBaseEur: 1.0,
  feePerKmEur: 0.02,
  feeMaxEur: 4.0,
};

export const DEFAULT_CONSUMPTION: Record<string, number> = {
  citadine: 5.5,
  berline: 6.5,
  suv: 8.0,
  break: 7.0,
  utilitaire: 10.0,
};

export function calculatePrice(params: {
  distanceKm: number;
  consumptionLPer100km: number;
  seats: number;
  config?: PricingConfig;
}): PriceBreakdown {
  const { distanceKm, consumptionLPer100km, seats } = params;
  const c = params.config ?? DEFAULT_CONFIG;

  if (!(distanceKm > 0)) throw new Error('distanceKm doit être > 0');
  if (!Number.isInteger(seats) || seats < 1 || seats > 7) throw new Error('seats doit être entre 1 et 7');
  if (!(consumptionLPer100km > 0)) throw new Error('consommation invalide');

  const fuelCostEur = (consumptionLPer100km / 100) * c.fuelPriceEurPerL * distanceKm;
  const wearCostEur = c.wearEurPerKm * distanceKm;
  const totalCostEur = fuelCostEur + wearCostEur;
  const passengerShareEur = totalCostEur / (seats + 1);
  const voyajFeeEur = Math.min(Math.max(c.feeBaseEur + c.feePerKmEur * distanceKm, c.feeBaseEur), c.feeMaxEur);

  // Les montants facturés sont arrondis AVANT de calculer le total,
  // pour que part + frais = total au centime près.
  const share = round2(passengerShareEur);
  const fee = round2(voyajFeeEur);
  return {
    distanceKm: round2(distanceKm),
    fuelCostEur: round2(fuelCostEur),
    wearCostEur: round2(wearCostEur),
    totalCostEur: round2(totalCostEur),
    passengerShareEur: share,
    voyajFeeEur: fee,
    passengerTotalEur: round2(share + fee),
    driverEarningsEur: share,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function toCents(eur: number): number {
  return Math.round(eur * 100);
}

/** Code de prise en charge à 4 chiffres (aléa cryptographique). */
export function generatePickupCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(1000 + (buf[0] % 9000));
}

/** Distance à vol d'oiseau (km). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
