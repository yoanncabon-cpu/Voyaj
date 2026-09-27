// ride-request — Le passager demande une course immédiate.
//
// 1. Calcule le prix côté serveur (jamais celui du client).
// 2. Crée la course en « awaiting_payment » + un PaymentIntent à capture manuelle
//    (autorisation seulement : l'argent n'est prélevé qu'à la confirmation).
// 3. Renvoie les paramètres de la PaymentSheet. Une fois la carte autorisée,
//    l'app appelle ride-confirm-payment qui lance la recherche de chauffeur.
//
// Entrée : { pickup: {lat,lng,address}, dest: {lat,lng,address} }
import {
  adminClient, assertNotSuspended, conflict, getProfile, place, requireUser, serve,
} from '../_shared/http.ts';
import { audit, loadPricing, routeDistanceKm } from '../_shared/domain.ts';
import { calculatePrice, toCents } from '../_shared/pricing.ts';
import { assertStripeConfigured, ensureCustomer, paymentSheetParams, stripe } from '../_shared/stripe.ts';

const MAX_DISTANCE_KM = 150;

serve(async (req, body) => {
  const user = await requireUser(req);
  const pickup = place(body.pickup, 'pickup');
  const dest = place(body.dest, 'dest');
  assertStripeConfigured();

  const db = adminClient();
  const profile = await getProfile(db, user.id);
  assertNotSuspended(profile);
  if (!profile.terms_accepted_at) throw conflict('Acceptez les conditions d\'utilisation pour continuer');

  // Une seule course active à la fois.
  const { data: active } = await db.from('rides').select('id')
    .eq('passenger_id', user.id)
    .in('status', ['awaiting_payment', 'searching', 'accepted', 'pickup', 'in_progress'])
    .limit(1);
  if (active?.length) {
    // Une demande restée en attente de paiement est simplement remplacée.
    const { data: stale } = await db.from('rides').select('id, status, stripe_payment_intent_id')
      .eq('id', active[0].id).single();
    if (stale?.status !== 'awaiting_payment') throw conflict('Vous avez déjà une course en cours');
    if (stale.stripe_payment_intent_id) await stripe.paymentIntents.cancel(stale.stripe_payment_intent_id).catch(() => {});
    await db.from('rides').update({ status: 'cancelled', cancel_reason: 'replaced', cancelled_at: new Date().toISOString() })
      .eq('id', stale.id);
  }

  const distanceKm = await routeDistanceKm(pickup, dest);
  if (distanceKm > MAX_DISTANCE_KM) throw conflict(`Course immédiate limitée à ${MAX_DISTANCE_KM} km : publiez plutôt un trajet programmé`);

  const { config, consumption } = await loadPricing(db);
  const price = calculatePrice({ distanceKm, consumptionLPer100km: consumption.berline, seats: 1, config });

  const { data: ride, error } = await db.from('rides').insert({
    passenger_id: user.id,
    status: 'awaiting_payment',
    pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_address: pickup.address,
    dest_lat: dest.lat, dest_lng: dest.lng, dest_address: dest.address,
    distance_km: distanceKm,
    price,
  }).select('id').single();
  if (error) throw error;

  const customerId = await ensureCustomer(db, profile, user.email ?? undefined);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: toCents(price.passengerTotalEur),
    currency: 'eur',
    customer: customerId,
    capture_method: 'manual',
    setup_future_usage: 'on_session',
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    description: `Voyaj — course ${ride.id.slice(0, 8)}`,
    metadata: { rideId: ride.id, kind: 'instant', platform: 'voyaj' },
  }, { idempotencyKey: `ride-${ride.id}` });

  await db.from('rides').update({ stripe_payment_intent_id: paymentIntent.id }).eq('id', ride.id);
  await audit(db, { action: 'ride.created', actorId: user.id, entityType: 'ride', entityId: ride.id, metadata: { distanceKm } });

  return {
    rideId: ride.id,
    price,
    distanceKm,
    ...(await paymentSheetParams(customerId, paymentIntent)),
  };
});
