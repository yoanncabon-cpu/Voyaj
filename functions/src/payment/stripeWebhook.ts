import { onRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/admin';
import { stripe } from '../shared/stripe';
import { writeAudit } from '../shared/audit';
import Stripe from 'stripe';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

/**
 * HTTP endpoint Stripe Webhook (non-callable, non-authentifié).
 * Idempotent : chaque event est stocké dans /stripe_events/{eventId}.
 * Si l'event existe déjà → 200 sans retraitement.
 *
 * Events traités :
 *   - payment_intent.payment_failed → marquer la course comme impayée
 *   - account.updated              → synchroniser le statut Connect du chauffeur
 *   - payout.paid                  → audit log
 */
export const stripeWebhook = onRequest(
  {
    region: 'europe-west1',
    // App Check NON requis pour les webhooks (appels externes Stripe)
    invoker: 'public',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    let event: Stripe.Event;
    try {
      const sig = req.headers['stripe-signature'] as string;
      event = stripe.webhooks.constructEvent(
        req.rawBody ?? req.body,
        sig,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).send('Webhook signature verification failed');
      return;
    }

    // Idempotence : vérifier si l'event a déjà été traité
    const eventRef = db.collection('stripe_events').doc(event.id);
    const eventSnap = await eventRef.get();
    if (eventSnap.exists) {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    // Enregistrer l'event immédiatement (before processing — évite les doubles traitements)
    await eventRef.set({
      eventId: event.id,
      type: event.type,
      createdAt: FieldValue.serverTimestamp(),
      processed: false,
    });

    try {
      await handleStripeEvent(event);
      await eventRef.update({ processed: true });
    } catch (err) {
      console.error(`Error processing Stripe event ${event.id}:`, err);
      await eventRef.update({ processed: false, error: String(err) });
      // Renvoyer 200 pour éviter que Stripe retenvoie → gérer la compensation manuellement
    }

    res.status(200).json({ received: true });
  },
);

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const rideId = pi.metadata?.rideId;
      if (!rideId) break;

      // Chercher la course (instant ou programmée)
      const rideDoc = await findRideByPaymentIntent(rideId, pi.id);
      if (rideDoc) {
        await rideDoc.ref.update({
          paymentFailed: true,
          paymentFailedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        await writeAudit({
          action: 'payment.refunded',
          actorId: rideDoc.data()?.passengerId ?? 'unknown',
          entityType: 'ride',
          entityId: rideId,
          metadata: { stripeEventId: event.id, paymentIntentId: pi.id, failure_reason: pi.last_payment_error?.message },
        });
      }
      break;
    }

    case 'payment_intent.succeeded': {
      // Déjà géré par updateRideStatus/confirmAndPay — audit seulement
      const pi = event.data.object as Stripe.PaymentIntent;
      const rideId = pi.metadata?.rideId;
      if (rideId) {
        await writeAudit({
          action: 'payment.captured',
          actorId: 'stripe',
          entityType: 'ride',
          entityId: rideId,
          metadata: { stripeEventId: event.id, paymentIntentId: pi.id },
        });
      }
      break;
    }

    case 'account.updated': {
      // Synchroniser le statut du compte Connect Express d'un chauffeur
      const account = event.data.object as Stripe.Account;
      const chargesEnabled = account.charges_enabled ?? false;
      const payoutsEnabled = account.payouts_enabled ?? false;

      // Trouver le chauffeur par stripeAccountId
      const usersSnap = await db.collection('users')
        .where('stripeAccountId', '==', account.id)
        .limit(1)
        .get();

      if (!usersSnap.empty) {
        const userDoc = usersSnap.docs[0];
        await userDoc.ref.update({
          stripeChargesEnabled: chargesEnabled,
          stripePayoutsEnabled: payoutsEnabled,
          stripeAccountStatus: chargesEnabled && payoutsEnabled ? 'active' : 'incomplete',
          updatedAt: FieldValue.serverTimestamp(),
        });
        await writeAudit({
          action: 'admin.action',
          actorId: 'stripe',
          entityType: 'user',
          entityId: userDoc.id,
          metadata: { stripeAccountId: account.id, chargesEnabled, payoutsEnabled },
        });
      }
      break;
    }

    case 'payout.paid': {
      const payout = event.data.object as Stripe.Payout;
      await writeAudit({
        action: 'wallet.debited',
        actorId: 'stripe',
        entityType: 'payout',
        entityId: payout.id,
        metadata: { amount: payout.amount, currency: payout.currency, stripeEventId: event.id },
      });
      break;
    }

    default:
      // Event non géré — pas d'erreur
      break;
  }
}

async function findRideByPaymentIntent(
  rideId: string,
  paymentIntentId: string,
): Promise<FirebaseFirestore.DocumentSnapshot | null> {
  // Chercher dans les courses instantanées
  const instantSnap = await db.collection('rides').doc(rideId).get();
  if (instantSnap.exists && instantSnap.data()?.stripePaymentIntentId === paymentIntentId) {
    return instantSnap;
  }

  // Chercher dans les réservations programmées
  const bookingsSnap = await db.collection('scheduled_bookings')
    .where('stripePaymentIntentId', '==', paymentIntentId)
    .limit(1)
    .get();

  return bookingsSnap.empty ? null : bookingsSnap.docs[0];
}
