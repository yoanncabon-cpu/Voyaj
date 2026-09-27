// ride-status — Toutes les transitions d'une course immédiate.
//
//   accepted    → pickup        'arrive'         (chauffeur)
//   pickup      → in_progress   'start'          (chauffeur, code à 4 chiffres + ≤ 150 m)
//   in_progress → ended         'end'            (chauffeur)
//   ended       → confirmed     'confirm'        (passager) — encaissement + virement
//   *           → cancelled     'cancel'         (l'un ou l'autre)
//   pickup      → passenger_absent 'report_absent' (chauffeur, après 5 min d'attente)
//
// Entrée : { rideId, action, pickupCode?, lat?, lng? }
import {
  adminClient, badRequest, conflict, forbidden, notFound, num, requireUser, serve, uuid,
} from '../_shared/http.ts';
import { audit, loadPricing } from '../_shared/domain.ts';
import { haversineKm } from '../_shared/pricing.ts';
import { cancelInstantRide, completeInstantRide, notifyParticipants } from '../_shared/rides.ts';

const WAIT_BEFORE_ABSENT_MS = 5 * 60_000;
const FREE_CANCEL_AFTER_ACCEPT_MS = 2 * 60_000;
const MAX_START_DISTANCE_KM = 0.15;

serve(async (req, body) => {
  const user = await requireUser(req);
  const rideId = uuid(body.rideId, 'rideId');
  const action = String(body.action ?? '');
  const db = adminClient();

  const { data: ride } = await db.from('rides').select('*').eq('id', rideId).maybeSingle();
  if (!ride) throw notFound('Course introuvable');
  const isDriver = ride.driver_id === user.id;
  const isPassenger = ride.passenger_id === user.id;
  if (!isDriver && !isPassenger) throw forbidden();

  const now = new Date().toISOString();
  const expect = (status: string) => {
    if (ride.status !== status) throw conflict(`Action impossible (statut actuel : ${ride.status})`);
  };
  const transition = async (from: string, patch: Record<string, unknown>) => {
    const { data } = await db.from('rides').update(patch).eq('id', rideId).eq('status', from).select('id').maybeSingle();
    if (!data) throw conflict('La course a changé entre-temps, rafraîchissez');
  };

  switch (action) {
    case 'arrive': {
      if (!isDriver) throw forbidden('Réservé au chauffeur');
      expect('accepted');
      await transition('accepted', { status: 'pickup', arrived_at: now });
      await notifyParticipants(db, ride, user.id, 'Votre chauffeur est arrivé', 'Donnez-lui votre code de prise en charge.');
      break;
    }

    case 'start': {
      if (!isDriver) throw forbidden('Réservé au chauffeur');
      expect('pickup');
      const code = String(body.pickupCode ?? '');
      const { data: secret } = await db.from('ride_secrets').select('pickup_code').eq('ride_id', rideId).single();
      if (!/^\d{4}$/.test(code) || code !== secret?.pickup_code) throw badRequest('Code de prise en charge incorrect');
      if (body.lat != null && body.lng != null) {
        const d = haversineKm(num(body.lat, 'lat'), num(body.lng, 'lng'), ride.pickup_lat, ride.pickup_lng);
        if (d > MAX_START_DISTANCE_KM) throw conflict('Vous êtes trop loin du point de prise en charge');
      }
      await transition('pickup', { status: 'in_progress', started_at: now });
      break;
    }

    case 'end': {
      if (!isDriver) throw forbidden('Réservé au chauffeur');
      expect('in_progress');
      await transition('in_progress', { status: 'ended', ended_at: now });
      await notifyParticipants(db, ride, user.id, 'Vous êtes arrivé·e', 'Confirmez la course pour régler le chauffeur (automatique sous 24 h).');
      break;
    }

    case 'confirm': {
      if (!isPassenger) throw forbidden('Réservé au passager');
      expect('ended');
      await completeInstantRide(db, ride, false);
      break;
    }

    case 'cancel': {
      if (!['awaiting_payment', 'searching', 'accepted', 'pickup'].includes(ride.status)) {
        throw conflict('Cette course ne peut plus être annulée');
      }
      const { lateCancelPenaltyEur } = await loadPricing(db);
      let penaltyEur = 0;
      // Le passager annule alors que le chauffeur est déjà arrivé, ou roule
      // vers lui depuis plus de 2 min : pénalité reversée au chauffeur.
      if (isPassenger && ride.status === 'pickup') penaltyEur = lateCancelPenaltyEur;
      if (isPassenger && ride.status === 'accepted' && ride.accepted_at &&
          Date.now() - new Date(ride.accepted_at).getTime() > FREE_CANCEL_AFTER_ACCEPT_MS) {
        penaltyEur = lateCancelPenaltyEur;
      }
      await cancelInstantRide(db, ride, { by: user.id, reason: isDriver ? 'driver_cancelled' : 'passenger_cancelled', penaltyEur });
      if (isDriver) {
        // Annulation chauffeur : passager remboursé intégralement, avertissement au chauffeur.
        const { data: p } = await db.from('profiles').select('warning_count').eq('id', user.id).single();
        await db.from('profiles').update({ warning_count: (p?.warning_count ?? 0) + 1 }).eq('id', user.id);
      }
      await notifyParticipants(db, ride, user.id, 'Course annulée',
        isDriver ? 'Le chauffeur a annulé. Vous n\'êtes pas débité·e.' : 'Le passager a annulé la course.');
      return { status: 'cancelled', penaltyEur };
    }

    case 'report_absent': {
      if (!isDriver) throw forbidden('Réservé au chauffeur');
      expect('pickup');
      if (!ride.arrived_at || Date.now() - new Date(ride.arrived_at).getTime() < WAIT_BEFORE_ABSENT_MS) {
        throw conflict('Attendez 5 minutes après votre arrivée avant de signaler une absence');
      }
      const { lateCancelPenaltyEur } = await loadPricing(db);
      await cancelInstantRide(db, ride, {
        by: user.id, reason: 'passenger_absent', penaltyEur: lateCancelPenaltyEur, finalStatus: 'passenger_absent',
      });
      await notifyParticipants(db, ride, user.id, 'Absence signalée',
        `Le chauffeur vous a attendu 5 min. ${lateCancelPenaltyEur.toFixed(2)} € de dédommagement ont été prélevés.`);
      return { status: 'passenger_absent' };
    }

    default:
      throw badRequest(`Action inconnue : ${action}`);
  }

  await audit(db, { action: `ride.${action}`, actorId: user.id, entityType: 'ride', entityId: rideId });
  return { success: true };
});
