// ride-confirm-payment — Après la PaymentSheet : vérifie auprès de Stripe que
// la carte est bien autorisée, génère le code de prise en charge et envoie
// la demande aux chauffeurs proches (notification haute priorité, 90 s).
//
// Entrée : { rideId }
import { adminClient, conflict, forbidden, notFound, requireUser, serve, uuid } from '../_shared/http.ts';
import { audit } from '../_shared/domain.ts';
import { generatePickupCode } from '../_shared/pricing.ts';
import { pushToUsers } from '../_shared/push.ts';
import { stripe } from '../_shared/stripe.ts';

const SEARCH_RADIUS_KM = 8;
const MAX_DRIVERS = 10;

serve(async (req, body) => {
  const user = await requireUser(req);
  const rideId = uuid(body.rideId, 'rideId');
  const db = adminClient();

  const { data: ride } = await db.from('rides').select('*').eq('id', rideId).maybeSingle();
  if (!ride) throw notFound('Course introuvable');
  if (ride.passenger_id !== user.id) throw forbidden();
  if (ride.status === 'searching') return { status: 'searching' }; // double appel : sans effet
  if (ride.status !== 'awaiting_payment') throw conflict('Cette course n\'attend plus de paiement');
  if (!ride.stripe_payment_intent_id) throw conflict('Paiement introuvable');

  const pi = await stripe.paymentIntents.retrieve(ride.stripe_payment_intent_id);
  if (pi.status !== 'requires_capture') throw conflict('Paiement non autorisé. Vérifiez votre carte.');

  // Passage atomique awaiting_payment → searching.
  const { data: updated } = await db.from('rides')
    .update({ status: 'searching', searching_at: new Date().toISOString() })
    .eq('id', rideId).eq('status', 'awaiting_payment')
    .select('id').maybeSingle();
  if (!updated) return { status: 'searching' };

  await db.from('ride_secrets').upsert({ ride_id: rideId, pickup_code: generatePickupCode() });

  const { data: drivers } = await db.rpc('nearby_drivers', {
    p_lat: ride.pickup_lat, p_lng: ride.pickup_lng,
    radius_km: SEARCH_RADIUS_KM, max_count: MAX_DRIVERS, exclude: user.id,
  });
  const offers = (drivers ?? []) as Array<{ driver_id: string; distance_km: number }>;

  if (offers.length) {
    await db.from('ride_offers').insert(offers.map((d) => ({
      ride_id: rideId, driver_id: d.driver_id, distance_km: Math.round(d.distance_km * 100) / 100,
    })));
    const { data: passenger } = await db.from('profiles').select('name').eq('id', user.id).single();
    await pushToUsers(db, offers.map((d) => d.driver_id), {
      title: 'Nouvelle demande de course',
      body: `${passenger?.name ?? 'Un passager'} · ${ride.pickup_address} → ${ride.dest_address} · ${ride.price.driverEarningsEur.toFixed(2)} €`,
      route: `/driver/offer/${rideId}`,
      data: { type: 'ride_request', rideId },
      urgent: true,
    });
  }

  await audit(db, {
    action: 'payment.authorized', actorId: user.id, entityType: 'ride', entityId: rideId,
    metadata: { paymentIntentId: pi.id, driversNotified: offers.length },
  });

  return { status: 'searching', driversNotified: offers.length };
});
