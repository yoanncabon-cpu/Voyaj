// dispute-create — Signalement d'un problème sur une course terminée/annulée.
// Un seul litige ouvert par course ; il suspend le virement automatique au
// chauffeur (la maintenance ne clôture pas un trajet en litige).
//
// Entrée : { rideId, kind: 'instant'|'scheduled', reason, description }
import { adminClient, conflict, forbidden, notFound, requireUser, serve, str, uuid, badRequest } from '../_shared/http.ts';
import { audit } from '../_shared/domain.ts';
import { pushToUsers } from '../_shared/push.ts';

const REASONS = ['wrong_price', 'no_show_driver', 'no_show_passenger', 'safety', 'vehicle', 'other'];

serve(async (req, body) => {
  const user = await requireUser(req);
  const rideId = uuid(body.rideId, 'rideId');
  const kind = body.kind === 'scheduled' ? 'scheduled' : 'instant';
  const reason = String(body.reason ?? '');
  if (!REASONS.includes(reason)) throw badRequest('Motif invalide');
  const description = str(body.description, 'description', 10, 1000);
  const db = adminClient();

  let snapshot: Record<string, unknown>;
  if (kind === 'instant') {
    const { data: ride } = await db.from('rides').select('*').eq('id', rideId).maybeSingle();
    if (!ride) throw notFound('Course introuvable');
    if (![ride.passenger_id, ride.driver_id].includes(user.id)) throw forbidden();
    if (!['ended', 'confirmed', 'cancelled', 'passenger_absent'].includes(ride.status)) {
      throw conflict('Un litige ne peut être ouvert qu\'après la course');
    }
    snapshot = { status: ride.status, price: ride.price, passengerId: ride.passenger_id, driverId: ride.driver_id,
      paymentIntentId: ride.stripe_payment_intent_id };
    await db.from('rides').update({ has_dispute: true }).eq('id', rideId);
  } else {
    const { data: sr } = await db.from('scheduled_rides').select('*').eq('id', rideId).maybeSingle();
    if (!sr) throw notFound('Trajet introuvable');
    const { data: booking } = await db.from('bookings').select('id').eq('scheduled_ride_id', rideId)
      .eq('passenger_id', user.id).maybeSingle();
    if (sr.driver_id !== user.id && !booking) throw forbidden();
    snapshot = { status: sr.status, price: sr.price, driverId: sr.driver_id };
  }

  const { data: dispute, error } = await db.from('disputes').insert({
    ride_id: rideId, ride_kind: kind, reporter_id: user.id, reason, description, snapshot,
  }).select('id').single();
  if (error?.code === '23505') throw conflict('Un litige est déjà ouvert pour ce trajet');
  if (error) throw error;

  const { data: admins } = await db.from('profiles').select('id').eq('is_admin', true);
  await pushToUsers(db, (admins ?? []).map((a) => a.id), {
    title: 'Nouveau litige',
    body: `${reason} — ${description.slice(0, 80)}`,
    route: `/admin/disputes`,
  });
  await audit(db, { action: 'ride.disputed', actorId: user.id, entityType: kind, entityId: rideId, metadata: { disputeId: dispute.id, reason } });
  return { disputeId: dispute.id };
});
