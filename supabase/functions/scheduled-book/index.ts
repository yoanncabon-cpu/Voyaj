// scheduled-book — Réserve des places sur un trajet programmé.
// Les places sont bloquées immédiatement (pas de survente), puis le passager
// paie via la PaymentSheet. Sans paiement sous 15 min, la maintenance libère
// les places. Le paiement est encaissé tout de suite et reversé au chauffeur
// après le trajet ; remboursé si annulation.
//
// Entrée : { scheduledRideId, seats }
import {
  adminClient, assertNotSuspended, conflict, forbidden, getProfile, int, notFound, requireUser, serve, uuid,
} from '../_shared/http.ts';
import { audit } from '../_shared/domain.ts';
import { generatePickupCode, round2, toCents } from '../_shared/pricing.ts';
import { assertStripeConfigured, ensureCustomer, paymentSheetParams, stripe } from '../_shared/stripe.ts';

serve(async (req, body) => {
  const user = await requireUser(req);
  const scheduledRideId = uuid(body.scheduledRideId, 'scheduledRideId');
  const seats = int(body.seats, 'seats', 1, 7);
  assertStripeConfigured();
  const db = adminClient();

  const profile = await getProfile(db, user.id);
  assertNotSuspended(profile);
  if (!profile.terms_accepted_at) throw conflict('Acceptez les conditions d\'utilisation pour continuer');

  const { data: sr } = await db.from('scheduled_rides').select('*').eq('id', scheduledRideId).maybeSingle();
  if (!sr) throw notFound('Trajet introuvable');
  if (sr.driver_id === user.id) throw forbidden('Vous ne pouvez pas réserver votre propre trajet');

  // Une réservation en attente de paiement est reprise plutôt que dupliquée.
  const { data: existing } = await db.from('bookings').select('*')
    .eq('scheduled_ride_id', scheduledRideId).eq('passenger_id', user.id)
    .in('status', ['pending_payment', 'confirmed']).maybeSingle();
  if (existing?.status === 'confirmed') throw conflict('Vous avez déjà réservé ce trajet');
  if (existing?.stripe_payment_intent_id && profile.stripe_customer_id) {
    const pi = await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id);
    if (pi.status !== 'canceled') {
      return { bookingId: existing.id, amountEur: Number(existing.amount_eur), ...(await paymentSheetParams(profile.stripe_customer_id, pi)) };
    }
  }
  if (existing) {
    // Tentative précédente inutilisable : on libère et on recommence proprement.
    await db.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', existing.id);
    await db.rpc('release_seats', { ride: scheduledRideId, n: existing.seats });
  }

  const { data: reserved } = await db.rpc('reserve_seats', { ride: scheduledRideId, n: seats });
  if (!reserved) throw conflict('Plus assez de places disponibles');

  const amountEur = round2(Number(sr.price.passengerTotalEur) * seats);
  try {
    const { data: booking, error } = await db.from('bookings').insert({
      scheduled_ride_id: scheduledRideId,
      passenger_id: user.id,
      seats,
      amount_eur: amountEur,
      pickup_code: generatePickupCode(),
      status: 'pending_payment',
    }).select('id').single();
    if (error) throw error;

    const customerId = await ensureCustomer(db, profile, user.email ?? undefined);
    const pi = await stripe.paymentIntents.create({
      amount: toCents(amountEur),
      currency: 'eur',
      customer: customerId,
      setup_future_usage: 'on_session',
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      description: `Voyaj — ${sr.origin_address} → ${sr.dest_address}`,
      metadata: { bookingId: booking.id, scheduledRideId, kind: 'scheduled', platform: 'voyaj' },
    }, { idempotencyKey: `booking-${booking.id}` });
    await db.from('bookings').update({ stripe_payment_intent_id: pi.id }).eq('id', booking.id);

    return { bookingId: booking.id, amountEur, ...(await paymentSheetParams(customerId, pi)) };
  } catch (e) {
    await db.rpc('release_seats', { ride: scheduledRideId, n: seats });
    await db.from('bookings').delete().eq('scheduled_ride_id', scheduledRideId)
      .eq('passenger_id', user.id).eq('status', 'pending_payment');
    await audit(db, { action: 'scheduled.book_failed', actorId: user.id, entityType: 'scheduled_ride', entityId: scheduledRideId });
    throw e;
  }
});
