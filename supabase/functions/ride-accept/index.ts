// ride-accept — Un chauffeur sollicité accepte la course.
// Le premier qui accepte l'obtient (mise à jour conditionnelle atomique).
//
// Entrée : { rideId }
import {
  adminClient, assertNotSuspended, conflict, forbidden, getProfile, requireUser, serve, uuid,
} from '../_shared/http.ts';
import { audit } from '../_shared/domain.ts';
import { pushToUsers } from '../_shared/push.ts';

const ACCEPT_WINDOW_MS = 90_000;

serve(async (req, body) => {
  const user = await requireUser(req);
  const rideId = uuid(body.rideId, 'rideId');
  const db = adminClient();

  const driver = await getProfile(db, user.id);
  assertNotSuspended(driver);
  if (!driver.is_verified) throw forbidden('Vérifiez votre identité pour conduire');

  const { data: offer } = await db.from('ride_offers').select('ride_id')
    .eq('ride_id', rideId).eq('driver_id', user.id).maybeSingle();
  if (!offer) throw forbidden('Cette demande ne vous a pas été proposée');

  const { data: vehicle } = await db.from('vehicles').select('*').eq('owner_id', user.id).maybeSingle();
  if (!vehicle) throw conflict('Enregistrez votre véhicule pour accepter des courses');

  const { data: ride } = await db.from('rides').select('status, searching_at, passenger_id').eq('id', rideId).single();
  if (ride?.status !== 'searching') throw conflict('Course déjà prise ou annulée');
  if (ride.searching_at && Date.now() - new Date(ride.searching_at).getTime() > ACCEPT_WINDOW_MS) {
    throw conflict('Délai d\'acceptation dépassé');
  }

  const vehicleDescription = [vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(' ') + ` · ${vehicle.plate}`;
  const { data: won } = await db.from('rides')
    .update({
      status: 'accepted',
      driver_id: user.id,
      accepted_at: new Date().toISOString(),
      vehicle_description: vehicleDescription,
    })
    .eq('id', rideId).eq('status', 'searching')
    .select('id').maybeSingle();
  if (!won) throw conflict('Un autre chauffeur a accepté avant vous');

  // Les autres chauffeurs sollicités n'ont plus accès à la demande.
  await db.from('ride_offers').delete().eq('ride_id', rideId).neq('driver_id', user.id);

  await pushToUsers(db, [ride.passenger_id], {
    title: 'Chauffeur trouvé !',
    body: `${driver.name ?? 'Votre chauffeur'} arrive · ${vehicleDescription}`,
    route: `/ride/${rideId}`,
    data: { type: 'ride_update', rideId },
  });
  await audit(db, { action: 'ride.accepted', actorId: user.id, entityType: 'ride', entityId: rideId });

  return { status: 'accepted' };
});
