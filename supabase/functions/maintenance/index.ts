// maintenance — Appelée chaque minute par pg_cron (secret partagé).
// Déployée avec --no-verify-jwt.
//
//   1. Demandes de course sans chauffeur après 90 s → expirées, carte libérée
//   2. Courses restées en attente de paiement > 15 min → annulées
//   3. Courses terminées non confirmées après 24 h → confirmées d'office (hors litige)
//   4. Réservations non payées > 15 min → places libérées
//   5. Trajets programmés passés de 24 h → gains virés au chauffeur (hors litige)
//   6. Suivis « bien rentré » échus → expirés
import { adminClient, requireWebhookSecret, serve } from '../_shared/http.ts';
import { cancelInstantRide, completeInstantRide } from '../_shared/rides.ts';
import { completeBooking, refundBookingFully } from '../_shared/bookings.ts';
import { pushToUsers } from '../_shared/push.ts';

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;

serve(async (req) => {
  requireWebhookSecret(req);
  const db = adminClient();
  const report: Record<string, number> = {};
  const step = async (name: string, fn: () => Promise<number>) => {
    try {
      report[name] = await fn();
    } catch (e) {
      console.error('maintenance', name, e);
      report[name] = -1;
    }
  };

  await step('expiredSearches', async () => {
    const { data } = await db.from('rides').select('*').eq('status', 'searching').lt('searching_at', ago(90_000)).limit(50);
    for (const ride of data ?? []) {
      if (await cancelInstantRide(db, ride, { by: null, reason: 'no_driver', penaltyEur: 0, finalStatus: 'expired' })) {
        await pushToUsers(db, [ride.passenger_id], {
          title: 'Aucun chauffeur disponible',
          body: 'Personne n\'a pu accepter votre course. Vous n\'avez pas été débité·e.',
          route: '/',
        });
      }
    }
    return data?.length ?? 0;
  });

  await step('abandonedPayments', async () => {
    const { data } = await db.from('rides').select('*').eq('status', 'awaiting_payment').lt('created_at', ago(15 * MIN)).limit(50);
    for (const ride of data ?? []) await cancelInstantRide(db, ride, { by: null, reason: 'payment_abandoned', penaltyEur: 0 });
    return data?.length ?? 0;
  });

  await step('autoConfirmed', async () => {
    const { data } = await db.from('rides').select('*').eq('status', 'ended').eq('has_dispute', false)
      .lt('ended_at', ago(24 * HOUR)).limit(50);
    for (const ride of data ?? []) await completeInstantRide(db, ride, true);
    return data?.length ?? 0;
  });

  await step('unpaidBookings', async () => {
    const { data } = await db.from('bookings').select('*').eq('status', 'pending_payment').lt('created_at', ago(15 * MIN)).limit(50);
    for (const b of data ?? []) {
      if (await refundBookingFully(db, b, 'payment_abandoned')) await db.rpc('release_seats', { ride: b.scheduled_ride_id, n: b.seats });
    }
    return data?.length ?? 0;
  });

  await step('completedTrips', async () => {
    const { data: trips } = await db.from('scheduled_rides').select('*')
      .in('status', ['published', 'full']).lt('departure_at', ago(24 * HOUR)).limit(20);
    let n = 0;
    for (const sr of trips ?? []) {
      const { data: disputes } = await db.from('disputes').select('id').eq('ride_id', sr.id).in('status', ['open', 'in_review']).limit(1);
      if (disputes?.length) continue;
      const { data: bookings } = await db.from('bookings').select('*').eq('scheduled_ride_id', sr.id).eq('status', 'confirmed');
      for (const b of bookings ?? []) await completeBooking(db, b, sr);
      await db.from('scheduled_rides').update({ status: 'completed' }).eq('id', sr.id);
      if (bookings?.length) await db.rpc('increment_rides', { uid: sr.driver_id });
      n++;
    }
    return n;
  });

  await step('expiredSafeReturns', async () => {
    const { data } = await db.from('safe_returns').update({ status: 'expired' })
      .eq('status', 'active').lt('expires_at', new Date().toISOString()).select('id');
    return data?.length ?? 0;
  });

  return report;
});
