// scheduled-publish — Un chauffeur vérifié publie un trajet programmé.
// Le prix par place est calculé avec la consommation de SON véhicule.
//
// Entrée : { origin: {lat,lng,address}, dest: {lat,lng,address}, departureAt (ISO),
//            seats (1-7), recurringDaily? }
import {
  adminClient, assertNotSuspended, badRequest, conflict, forbidden, getProfile, int, place, requireUser, serve,
} from '../_shared/http.ts';
import { audit, loadPricing, routeDistanceKm } from '../_shared/domain.ts';
import { calculatePrice } from '../_shared/pricing.ts';

const MAX_DAYS_AHEAD = 14;

serve(async (req, body) => {
  const user = await requireUser(req);
  const origin = place(body.origin, 'origin');
  const dest = place(body.dest, 'dest');
  const seats = int(body.seats, 'seats', 1, 7);
  const departure = new Date(String(body.departureAt ?? ''));
  if (Number.isNaN(departure.getTime())) throw badRequest('Date de départ invalide');
  const minutesAhead = (departure.getTime() - Date.now()) / 60_000;
  if (minutesAhead < 30) throw badRequest('Le départ doit être dans au moins 30 minutes');
  if (minutesAhead > MAX_DAYS_AHEAD * 24 * 60) throw badRequest(`Publication possible jusqu'à ${MAX_DAYS_AHEAD} jours à l'avance`);

  const db = adminClient();
  const profile = await getProfile(db, user.id);
  assertNotSuspended(profile);
  if (!profile.is_verified) throw forbidden('Vérifiez votre identité avant de publier un trajet');

  const { data: vehicle } = await db.from('vehicles').select('*').eq('owner_id', user.id).maybeSingle();
  if (!vehicle) throw conflict('Enregistrez votre véhicule avant de publier');
  if (seats > vehicle.seats) throw badRequest(`Votre véhicule n'a que ${vehicle.seats} place(s) passager`);

  const { config, consumption } = await loadPricing(db);
  const distanceKm = await routeDistanceKm(origin, dest);
  const consumptionLPer100km = Number(vehicle.consumption_l_per_100km) || consumption[vehicle.vehicle_type] || consumption.berline;
  // Le prix est calculé pour une voiture pleine : chaque passager paie sa part.
  const price = calculatePrice({ distanceKm, consumptionLPer100km, seats, config });

  const { data: ride, error } = await db.from('scheduled_rides').insert({
    driver_id: user.id,
    origin_address: origin.address, origin_lat: origin.lat, origin_lng: origin.lng,
    dest_address: dest.address, dest_lat: dest.lat, dest_lng: dest.lng,
    departure_at: departure.toISOString(),
    seats,
    distance_km: distanceKm,
    price,
    recurring_daily: body.recurringDaily === true,
  }).select('id').single();
  if (error) throw error;

  await audit(db, { action: 'scheduled.published', actorId: user.id, entityType: 'scheduled_ride', entityId: ride.id });
  return { scheduledRideId: ride.id, price, distanceKm };
});
