import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../shared/admin';
import { capturePaymentIntent, transferToDriver, eurToCents } from '../../shared/stripe';
import { sendPushNotification } from '../../shared/fcm';
import { writeAudit } from '../../shared/audit';

/**
 * Cron toutes les 5 minutes : confirme automatiquement les courses
 * en status 'ended' depuis plus de 24 h sans action du passager.
 */
export const autoConfirmRides = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'europe-west1',
    timeoutSeconds: 120,
  },
  async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const snapshot = await db
      .collection('rides')
      .where('status', '==', 'ended')
      .where('endedAt', '<', cutoff)
      .limit(50)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    const now = FieldValue.serverTimestamp();

    for (const doc of snapshot.docs) {
      const ride = doc.data();
      const rideId = doc.id;

      try {
        // Capture Stripe
        if (ride.stripePaymentIntentId) {
          await capturePaymentIntent(ride.stripePaymentIntentId);
          await writeAudit({
            action: 'payment.captured',
            actorId: 'system',
            entityType: 'ride',
            entityId: rideId,
            metadata: { autoConfirmed: true },
          });

          // Transfert au chauffeur
          const driverDoc = await db.collection('users').doc(ride.driverId).get();
          const driver = driverDoc.data();
          if (driver?.stripeAccountId) {
            const transfer = await transferToDriver({
              amountCents: eurToCents(ride.priceBreakdown.driverEarningsEur),
              driverAccountId: driver.stripeAccountId,
              rideId,
            });
            await writeAudit({
              action: 'payment.transfer',
              actorId: 'system',
              entityType: 'ride',
              entityId: rideId,
              metadata: { transferId: transfer.id, autoConfirmed: true },
            });
          }

          // Notifier les deux parties
          await notifyBothParties(ride, rideId);
        }

        batch.update(doc.ref, {
          status: 'confirmed',
          confirmedAt: now,
          autoConfirmed: true,
          updatedAt: now,
        });

        await writeAudit({
          action: 'ride.auto_confirmed',
          actorId: 'system',
          entityType: 'ride',
          entityId: rideId,
        });
      } catch (err) {
        console.error(`autoConfirm failed for ride ${rideId}:`, err);
        // Continuer avec les autres courses
      }
    }

    await batch.commit();
    console.log(`Auto-confirmed ${snapshot.size} rides`);
  },
);

async function notifyBothParties(ride: FirebaseFirestore.DocumentData, rideId: string): Promise<void> {
  const [passengerDoc, driverDoc] = await Promise.all([
    db.collection('users').doc(ride.passengerId).get(),
    db.collection('users').doc(ride.driverId).get(),
  ]);

  const tokens = [
    passengerDoc.data()?.fcmToken,
    driverDoc.data()?.fcmToken,
  ].filter(Boolean) as string[];

  if (tokens.length > 0) {
    await sendPushNotification({
      fcmTokens: tokens,
      title: 'Course confirmée',
      body: 'Votre course a été confirmée automatiquement',
      data: { type: 'ride_auto_confirmed', rideId },
    });
  }
}
