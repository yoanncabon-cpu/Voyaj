// scheduled-cancel — Annulation d'un trajet programmé.
//   { bookingId }        → le passager annule sa réservation
//   { scheduledRideId }  → le chauffeur annule tout le trajet (passagers remboursés)
import { adminClient, badRequest, conflict, forbidden, notFound, requireUser, serve, uuid } from '../_shared/http.ts';
import { audit, loadPricing } from '../_shared/domain.ts';
import { cancelBookingByPassenger, refundBookingFully } from '../_shared/bookings.ts';
import { pushToUsers } from '../_shared/push.ts';

serve(async (req, body) => {
  const user = await requireUser(req);
  const db = adminClient();

  if (body.bookingId) {
    const bookingId = uuid(body.bookingId, 'bookingId');
    const { data: booking } = await db.from('bookings').select('*').eq('id', bookingId).maybeSingle();
    if (!booking) throw notFound('Réservation introuvable');
    if (booking.passenger_id !== user.id) throw forbidden();
    const { data: sr } = await db.from('scheduled_rides').select('driver_id, departure_at').eq('id', booking.scheduled_ride_id).single();
    if (!sr) throw notFound('Trajet introuvable');
    if (new Date(sr.departure_at).getTime() < Date.now()) throw conflict('Le trajet est déjà parti');

    const { lateCancelPenaltyEur } = await loadPricing(db);
    const result = await cancelBookingByPassenger(db, booking, sr.departure_at, lateCancelPenaltyEur);
    if (booking.status === 'confirmed') {
      await pushToUsers(db, [sr.driver_id], {
        title: 'Réservation annulée',
        body: `Un passager a libéré ${booking.seats} place(s).`,
        route: `/scheduled/${booking.scheduled_ride_id}`,
      });
    }
    return { success: true, ...result };
  }

  if (body.scheduledRideId) {
    const scheduledRideId = uuid(body.scheduledRideId, 'scheduledRideId');
    const { data: sr } = await db.from('scheduled_rides').select('*').eq('id', scheduledRideId).maybeSingle();
    if (!sr) throw notFound('Trajet introuvable');
    if (sr.driver_id !== user.id) throw forbidden('Réservé au chauffeur');
    if (!['published', 'full'].includes(sr.status)) throw conflict('Trajet non annulable');

    await db.from('scheduled_rides').update({ status: 'cancelled' }).eq('id', scheduledRideId);
    const { data: bookings } = await db.from('bookings').select('*')
      .eq('scheduled_ride_id', scheduledRideId).in('status', ['pending_payment', 'confirmed']);
    for (const b of bookings ?? []) await refundBookingFully(db, b, 'driver_cancelled');

    const passengers = (bookings ?? []).filter((b) => b.status === 'confirmed').map((b) => b.passenger_id);
    await pushToUsers(db, passengers, {
      title: 'Trajet annulé',
      body: `Le chauffeur a annulé ${sr.origin_address} → ${sr.dest_address}. Vous êtes remboursé·e intégralement.`,
      route: '/(tabs)/trajets',
    });
    // Annuler moins de 24 h avant le départ avec des passagers : avertissement.
    if (passengers.length && new Date(sr.departure_at).getTime() - Date.now() < 24 * 3_600_000) {
      const { data: p } = await db.from('profiles').select('warning_count').eq('id', user.id).single();
      await db.from('profiles').update({ warning_count: (p?.warning_count ?? 0) + 1 }).eq('id', user.id);
    }
    await audit(db, { action: 'scheduled.cancelled', actorId: user.id, entityType: 'scheduled_ride', entityId: scheduledRideId,
      metadata: { refunded: bookings?.length ?? 0 } });
    return { success: true, refunded: passengers.length };
  }

  throw badRequest('bookingId ou scheduledRideId requis');
});
