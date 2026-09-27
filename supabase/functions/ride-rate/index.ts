// ride-rate — Note mutuelle après une course (immédiate ou programmée).
// Une seule note par personne et par course.
//
// Entrée : { rideId, kind: 'instant' | 'scheduled', score: 1-5, comment?, ratedUserId? }
//   ratedUserId n'est utile que pour un trajet programmé (le chauffeur note un passager précis).
import {
  adminClient, badRequest, conflict, forbidden, int, notFound, requireUser, serve, uuid,
} from '../_shared/http.ts';
import { audit, awardPoints, POINTS } from '../_shared/domain.ts';

serve(async (req, body) => {
  const user = await requireUser(req);
  const rideId = uuid(body.rideId, 'rideId');
  const kind = body.kind === 'scheduled' ? 'scheduled' : 'instant';
  const score = int(body.score, 'score', 1, 5);
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 500) || null : null;
  const db = adminClient();

  let ratedId: string;
  if (kind === 'instant') {
    const { data: ride } = await db.from('rides').select('passenger_id, driver_id, status').eq('id', rideId).maybeSingle();
    if (!ride) throw notFound('Course introuvable');
    if (![ride.passenger_id, ride.driver_id].includes(user.id)) throw forbidden();
    if (!['ended', 'confirmed'].includes(ride.status)) throw conflict('La course doit être terminée pour noter');
    ratedId = user.id === ride.driver_id ? ride.passenger_id : ride.driver_id;
  } else {
    const { data: sr } = await db.from('scheduled_rides').select('driver_id, departure_at').eq('id', rideId).maybeSingle();
    if (!sr) throw notFound('Trajet introuvable');
    if (new Date(sr.departure_at).getTime() > Date.now()) throw conflict('Le trajet n\'a pas encore eu lieu');
    if (user.id === sr.driver_id) {
      ratedId = uuid(body.ratedUserId, 'ratedUserId');
      const { data: b } = await db.from('bookings').select('id').eq('scheduled_ride_id', rideId)
        .eq('passenger_id', ratedId).in('status', ['confirmed', 'completed']).maybeSingle();
      if (!b) throw badRequest('Ce passager n\'a pas voyagé avec vous');
    } else {
      const { data: b } = await db.from('bookings').select('id').eq('scheduled_ride_id', rideId)
        .eq('passenger_id', user.id).in('status', ['confirmed', 'completed']).maybeSingle();
      if (!b) throw forbidden();
      ratedId = sr.driver_id;
    }
  }

  const { error } = await db.from('ratings').insert({
    ride_id: rideId, ride_kind: kind, rater_id: user.id, rated_id: ratedId, score, comment,
  });
  if (error?.code === '23505') throw conflict('Vous avez déjà noté ce trajet');
  if (error) throw error;

  await db.rpc('apply_rating', { uid: ratedId, score });
  await awardPoints(db, user.id, POINTS.ratingSubmitted, 'rating_submitted', rideId);
  await audit(db, { action: 'ride.rated', actorId: user.id, entityType: 'ride', entityId: rideId, metadata: { score, ratedId } });
  return { success: true };
});
