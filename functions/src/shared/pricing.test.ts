import { calculatePrice, generatePickupCode } from './pricing';

describe('calculatePrice', () => {
  const baseParams = {
    distanceKm: 10,
    fuelConsumptionLper100km: 7.0,
    fuelPriceEurPerL: 1.85,
    seats: 1,
  };

  it('calcule le prix pour un trajet de 10 km, 1 siège', () => {
    const result = calculatePrice(baseParams);

    // fuelCost = (7/100) × 1.85 × 10 = 1.295
    expect(result.fuelCostEur).toBeCloseTo(1.3, 1);
    // wearCost = 0.12 × 10 = 1.20
    expect(result.wearCostEur).toBe(1.2);
    // totalCost = 1.295 + 1.20 = 2.495
    expect(result.totalCostEur).toBeCloseTo(2.5, 1);
    // passengerShare = 2.495 / 2 = 1.2475
    expect(result.passengerShareEur).toBeCloseTo(1.25, 1);
    // voyajFee = 1 + 0.02 × 10 = 1.20
    expect(result.voyajFeeEur).toBe(1.2);
    // passengerTotal = 1.2475 + 1.20 = 2.4475
    expect(result.passengerTotalEur).toBeCloseTo(2.45, 1);
  });

  it('plafonne les frais Voyaj à 4 € pour les longs trajets', () => {
    const result = calculatePrice({ ...baseParams, distanceKm: 300 });
    expect(result.voyajFeeEur).toBe(4.0);
  });

  it('frais Voyaj minimum à 1 € pour les très courts trajets', () => {
    // 1 + 0.02 × 0.1 = 1.002 → 1.00 après arrondi
    const result = calculatePrice({ ...baseParams, distanceKm: 0.1 });
    expect(result.voyajFeeEur).toBe(1.0);
    // 1 km → 1.02 € (la formule n'atteint le plancher qu'à ~0 km)
    expect(calculatePrice({ ...baseParams, distanceKm: 1 }).voyajFeeEur).toBe(1.02);
  });

  it('répartit correctement avec 3 sièges', () => {
    const result = calculatePrice({ ...baseParams, seats: 3 });
    // passengerShare = total / 4
    // Les deux valeurs sont arrondies séparément → écart max d'un centime
    expect(Math.abs(result.passengerShareEur - result.totalCostEur / 4)).toBeLessThanOrEqual(0.01);
  });

  it('lève une erreur si distanceKm <= 0', () => {
    expect(() => calculatePrice({ ...baseParams, distanceKm: 0 })).toThrow();
    expect(() => calculatePrice({ ...baseParams, distanceKm: -5 })).toThrow();
  });

  it('lève une erreur si seats est hors plage', () => {
    expect(() => calculatePrice({ ...baseParams, seats: 0 })).toThrow();
    expect(() => calculatePrice({ ...baseParams, seats: 8 })).toThrow();
  });

  it('retourne des valeurs arrondies à 2 décimales', () => {
    const result = calculatePrice(baseParams);
    const vals = [
      result.fuelCostEur,
      result.wearCostEur,
      result.totalCostEur,
      result.passengerShareEur,
      result.voyajFeeEur,
      result.passengerTotalEur,
    ];
    for (const v of vals) {
      expect(v).toBe(Math.round(v * 100) / 100);
    }
  });
});

describe('generatePickupCode', () => {
  it('génère un code à 4 chiffres', () => {
    const code = generatePickupCode();
    expect(code).toMatch(/^\d{4}$/);
  });

  it('génère des codes différents (probabiliste)', () => {
    const codes = new Set(Array.from({ length: 20 }, generatePickupCode));
    expect(codes.size).toBeGreaterThan(5);
  });
});
