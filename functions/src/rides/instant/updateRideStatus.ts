import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, GeoPoint } from 'firebase-admin/firestore';
import { db } from '../../shared/admin';
import { capturePaymentIntent, refundPaymentIntent, transferToDriver, eurToCents } from '../../shared/stripe';
import { sendPushNotification } from '../../shared/fcm';
import { writeAudit } from '../../shared/audit';
import {
  unauthenticated, notFound, failedPrecondition, invalidArgument, permissionDenied,
} from '../../shared/errors';

type RideAction = 'arrive' | 'start' | 'end' | 'confirm' | 'cancel' | 'report_absent';

interface UpdateRideStatusParams {
  rideId: string;
  action: RideAction;
  pickupCode?: string; // requis pour 'start'
  lat?: number;
  lng?: number;
}

/**
 * Callable : met à jour le statut d'une course immédiate.
 * Centralise toutes les transitions d'état dans une seule function.
 *
 * Transitions :
 *   accepted → pickup (chauffeur arrive = 'arrive')
 *   pickup   → in_progress (chauffeur démarre = 'start', code vérifié)
 *   in_progress → ended (chauffeur termine = 'end')
 *   ended → confirmed (passager confirme = 'confirm' ou auto après 24 h)
 *   [tout statut] → cancelled
 *   pickup → absent_passenger ('report_absent')
 */
export const updateRideStatus = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const { rideId, action, pickupCode, lat, lng } =
      request.data as UpdateRideStatusParams;

    if (!rideId || !action) throw invalidArgument('rideId et action requis');

    const rideRef = db.collection('rides').doc(rideId);
    const rideSnap = await rideRef.get();
    if (!rideSnap.exists) throw notFound('Course introuvable');

    const ride = rideSnap.data()!;

    // Vérification que l'appelant est bien impliqué dans la course
    const isDriver = ride.driverId === uid;
    const isPassenger = ride.passengerId === uid;
    if (!isDriver && !isPassenger) throw permissionDenied('Non participant');

    const now = FieldValue.serverTimestamp();
    const updates: Record<string, unknown> = { updatedAt: now };

    switch (action) {
      case 'arrive': {
        if (!isDriver) throw permissionDenied('Réservé au chauffeur');
        if (ride.status !== 'accepted') {
          throw failedPrecondition(`Statut attendu: accepted, actuel: ${ride.status}`);
        }
        updates.status = 'pickup';
        updates.arrivedAt = now;
        if (lat != null && lng != null) {
          updates.driverArrivedLocation = new GeoPoint(lat, lng);
        }

        // Notifier le passager
        await notifyOtherParty(ride, isDriver, 'Le chauffeur est arrivé', 'Présentez votre code au chauffeur', rideId);
        break;
      }

      case 'start': {
        if (!isDriver) throw permissionDenied('Réservé au chauffeur');
        if (ride.status !== 'pickup') {
          throw failedPrecondition(`Statut attendu: pickup, actuel: ${ride.status}`);
        }
        // Vérification du code 4 chiffres
        if (!pickupCode || pickupCode !== ride.pickupCode) {
          throw invalidArgument('Code de prise en charge incorrect');
        }
        // Vérification de la proximité serveur (lat/lng fournis)
        if (lat != null && lng != null) {
          const distanceM = haversineMeters(lat, lng, ride.pickupLat, ride.pickupLng);
          if (distanceM > 150) {
            throw failedPrecondition('Trop loin du point de départ (> 150 m)');
          }
        }
        updates.status = 'in_progress';
        updates.startedAt = now;
        break;
      }

      case 'end': {
        if (!isDriver) throw permissionDenied('Réservé au chauffeur');
        if (ride.status !== 'in_progress') {
          throw failedPrecondition(`Statut attendu: in_progress, actuel: ${ride.status}`);
        }
        updates.status = 'ended';
        updates.endedAt = now;
        if (lat != null && lng != null) {
          updates.dropoffLocation = new GeoPoint(lat, lng);
        }

        await notifyOtherParty(ride, isDriver, 'Course terminée', 'Confirmez votre trajet pour libérer le paiement', rideId);
        break;
      }

      case 'confirm': {
        if (!isPassenger) throw permissionDenied('Réservé au passager');
        if (ride.status !== 'ended') {
          throw failedPrecondition(`Statut attendu: ended, actuel: ${ride.status}`);
        }
        // Capture du paiement + transfert au chauffeur
        await confirmAndPay(ride, rideId);
        updates.status = 'confirmed';
        updates.confirmedAt = now;
        break;
      }

      case 'cancel': {
        await handleCancel(ride, rideId, uid, isDriver, isPassenger);
        updates.status = 'cancelled';
        updates.cancelledAt = now;
        updates.cancelledBy = uid;
        break;
      }

      case 'report_absent': {
        if (!isDriver) throw permissionDenied('Réservé au chauffeur');
        if (ride.status !== 'pickup') {
          throw failedPrecondition('Signalement impossible à ce stade');
        }
        // Remote Config vérifie si feature_pay_driver_on_no_show est actif
        // (géré par la function de pénalité séparément)
        updates.status = 'passenger_absent';
        updates.absentReportedAt = now;
        break;
      }

      default:
        throw invalidArgument(`Action inconnue: ${action}`);
    }

    await rideRef.update(updates);

    await writeAudit({
      action: `ride.${action}` as never,
      actorId: uid,
      entityType: 'ride',
      entityId: rideId,
    });

    return { success: true };
  },
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function confirmAndPay(ride: FirebaseFirestore.DocumentData, rideId: string): Promise<void> {
  if (!ride.stripePaymentIntentId) return;

  await capturePaymentIntent(ride.stripePaymentIntentId);

  await writeAudit({
    action: 'payment.captured',
    actorId: ride.passengerId,
    entityType: 'ride',
    entityId: rideId,
    metadata: { stripePaymentIntentId: ride.stripePaymentIntentId },
  });

  // Transfert au chauffeur (gains = passengerShare)
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
      actorId: ride.driverId,
      entityType: 'ride',
      entityId: rideId,
      metadata: { transferId: transfer.id },
    });
  }
}

async function handleCancel(
  ride: FirebaseFirestore.DocumentData,
  rideId: string,
  uid: string,
  isDriver: boolean,
  isPassenger: boolean,
): Promise<void> {
  // Remboursement selon le statut
  if (['searching', 'accepted', 'pickup'].includes(ride.status)) {
    if (ride.stripePaymentIntentId) {
      await refundPaymentIntent({
        paymentIntentId: ride.stripePaymentIntentId,
        reason: 'requested_by_customer',
      });
      await writeAudit({
        action: 'payment.refunded',
        actorId: uid,
        entityType: 'ride',
        entityId: rideId,
      });
    }
  }

  const isOtherPartyId = isDriver ? ride.passengerId : ride.driverId;
  const otherPartyDoc = await db.collection('users').doc(isOtherPartyId).get();
  const otherParty = otherPartyDoc.data();
  if (otherParty?.fcmToken) {
    await sendPushNotification({
      fcmTokens: [otherParty.fcmToken],
      title: 'Course annulée',
      body: isDriver ? 'Le chauffeur a annulé la course' : 'Le passager a annulé la course',
      data: { type: 'ride_cancelled', rideId },
    });
  }

  await writeAudit({
    action: 'ride.cancelled',
    actorId: uid,
    entityType: 'ride',
    entityId: rideId,
    metadata: { cancelledBy: isDriver ? 'driver' : 'passenger', previousStatus: ride.status },
  });
}

async function notifyOtherParty(
  ride: FirebaseFirestore.DocumentData,
  callerIsDriver: boolean,
  title: string,
  body: string,
  rideId: string,
): Promise<void> {
  const targetUid = callerIsDriver ? ride.passengerId : ride.driverId;
  if (!targetUid) return;
  const targetDoc = await db.collection('users').doc(targetUid).get();
  const target = targetDoc.data();
  if (target?.fcmToken) {
    await sendPushNotification({
      fcmTokens: [target.fcmToken],
      title,
      body,
      data: { type: 'ride_update', rideId },
    });
  }
}

/** Distance en mètres entre deux coordonnées GPS (formule de Haversine) */
function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
