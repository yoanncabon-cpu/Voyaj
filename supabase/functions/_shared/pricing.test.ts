import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { calculatePrice, generatePickupCode, haversineKm } from './pricing.ts';

const base = { distanceKm: 10, consumptionLPer100km: 7, seats: 1 };

Deno.test('prix 10 km, 1 place', () => {
  const p = calculatePrice(base);
  assertEquals(p.fuelCostEur, 1.3); // 0,07 × 1,85 × 10 = 1,295
  assertEquals(p.wearCostEur, 1.2);
  assertEquals(p.totalCostEur, 2.5); // 2,495
  assertEquals(p.passengerShareEur, 1.25);
  assertEquals(p.voyajFeeEur, 1.2);
  assertEquals(p.passengerTotalEur, 2.45);
  assertEquals(p.driverEarningsEur, p.passengerShareEur);
});

Deno.test('total = part + frais au centime près', () => {
  for (const km of [1, 3.7, 12.34, 55, 180, 640]) {
    for (let seats = 1; seats <= 7; seats++) {
      const p = calculatePrice({ distanceKm: km, consumptionLPer100km: 6.5, seats });
      assertEquals(p.passengerTotalEur, Math.round((p.passengerShareEur + p.voyajFeeEur) * 100) / 100);
    }
  }
});

Deno.test('frais plafonnés à 4 €', () => {
  assertEquals(calculatePrice({ ...base, distanceKm: 300 }).voyajFeeEur, 4);
});

Deno.test('frais : 1 € + 2 cts/km', () => {
  assertEquals(calculatePrice({ ...base, distanceKm: 0.1 }).voyajFeeEur, 1);
  assertEquals(calculatePrice({ ...base, distanceKm: 1 }).voyajFeeEur, 1.02);
});

Deno.test('le chauffeur ne gagne jamais plus que sa part des frais', () => {
  const p = calculatePrice({ ...base, seats: 3 });
  assert(p.driverEarningsEur * 4 <= p.totalCostEur + 0.02);
});

Deno.test('paramètres invalides', () => {
  assertThrows(() => calculatePrice({ ...base, distanceKm: 0 }));
  assertThrows(() => calculatePrice({ ...base, seats: 0 }));
  assertThrows(() => calculatePrice({ ...base, seats: 8 }));
  assertThrows(() => calculatePrice({ ...base, seats: 1.5 }));
});

Deno.test('code à 4 chiffres', () => {
  for (let i = 0; i < 200; i++) assert(/^\d{4}$/.test(generatePickupCode()));
});

Deno.test('haversine Paris → Lyon ≈ 392 km', () => {
  const d = haversineKm(48.8566, 2.3522, 45.764, 4.8357);
  assert(d > 385 && d < 400, `obtenu ${d}`);
});
