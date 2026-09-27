// price-estimate — Estimation du prix affichée AVANT la demande.
// Le prix réellement facturé est recalculé côté serveur par ride-request.
// Entrée : { pickup: {lat,lng,address}, dest: {lat,lng,address}, seats? }
import { int, place, requireUser, serve } from '../_shared/http.ts';
import { loadPricing, routeDistanceKm } from '../_shared/domain.ts';
import { calculatePrice } from '../_shared/pricing.ts';
import { adminClient } from '../_shared/http.ts';

serve(async (req, body) => {
  await requireUser(req);
  const pickup = place(body.pickup, 'pickup');
  const dest = place(body.dest, 'dest');
  const seats = body.seats == null ? 1 : int(body.seats, 'seats', 1, 7);

  const db = adminClient();
  const { config, consumption } = await loadPricing(db);
  const distanceKm = await routeDistanceKm(pickup, dest);
  // Véhicule inconnu à ce stade : berline par défaut.
  const price = calculatePrice({ distanceKm, consumptionLPer100km: consumption.berline, seats, config });
  return { distanceKm, price };
});
