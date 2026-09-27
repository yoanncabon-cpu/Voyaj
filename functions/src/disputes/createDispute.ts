import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/admin';
import {
  unauthenticated, notFound, failedPrecondition, invalidArgument, permissionDenied, alreadyExists,
} from '../shared/errors';
import { writeAudit } from '../shared/audit';
import { sendPushNotification } from '../shared/fcm';

type DisputeReason =
  | 'wrong_price'
  | 'no_show_driver'
  | 'safety'
  | 'vehicle'
  | 'other';

interface CreateDisputeParams {
  rideId: string;
  reason: DisputeReason;
  description: string;
}

const VALID_REASONS: DisputeReason[] = [
  'wrong_price', 'no_show_driver', 'safety', 'vehicle', 'other',
];

/**
 * Callable : crée un litige sur une course.
 * Un seul litige actif par course.
 * Notifie l'admin par FCM (topic admin_disputes).
 */
export const createDispute = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const { rideId, reason, description } = request.data as CreateDisputeParams;

    if (!rideId) throw invalidArgument('rideId requis');
    if (!reason || !VALID_REASONS.includes(reason)) {
      throw invalidArgument(`reason doit être parmi: ${VALID_REASONS.join(', ')}`);
    }
    if (!description || description.trim().length < 10) {
      throw invalidArgument('description doit faire au moins 10 caractères');
    }
    if (description.length > 1000) {
      throw invalidArgument('description ne peut pas dépasser 1000 caractères');
    }

    const rideRef = db.collection('rides').doc(rideId);
    const rideSnap = await rideRef.get();
    if (!rideSnap.exists) throw notFound('Course introuvable');

    const ride = rideSnap.data()!;

    const isDriver = ride.driverId === uid;
    const isPassenger = ride.passengerId === uid;
    if (!isDriver && !isPassenger) throw permissionDenied('Non participant');

    if (!['ended', 'confirmed', 'cancelled', 'passenger_absent'].includes(ride.status)) {
      throw failedPrecondition('Litige impossible sur une course non terminée');
    }

    // Un seul litige actif par course
    const existingDispute = await db.collection('disputes')
      .where('rideId', '==', rideId)
      .where('status', 'in', ['open', 'in_review'])
      .limit(1)
      .get();

    if (!existingDispute.empty) {
      throw alreadyExists('Un litige est déjà ouvert pour cette course');
    }

    const now = FieldValue.serverTimestamp();
    const disputeRef = await db.collection('disputes').add({
      rideId,
      reporterId: uid,
      reporterRole: isDriver ? 'driver' : 'passenger',
      reason,
      description: description.trim(),
      status: 'open',
      createdAt: now,
      updatedAt: now,
      // Snapshot des données de la course au moment du litige
      rideSnapshot: {
        passengerId: ride.passengerId,
        driverId: ride.driverId,
        status: ride.status,
        priceBreakdown: ride.priceBreakdown ?? null,
        stripePaymentIntentId: ride.stripePaymentIntentId ?? null,
      },
    });

    // Marquer la course comme disputée
    await rideRef.update({
      hasDispute: true,
      disputeId: disputeRef.id,
      updatedAt: now,
    });

    // Notifier les admins (topic FCM)
    try {
      await sendPushNotification({
        topic: 'admin_disputes',
        title: '⚠️ Nouveau litige',
        body: `Course ${rideId} — Motif : ${reason}`,
        data: { type: 'new_dispute', disputeId: disputeRef.id, rideId },
      });
    } catch {
      // Ne pas bloquer la création du litige si la notification échoue
    }

    await writeAudit({
      action: 'ride.disputed',
      actorId: uid,
      entityType: 'ride',
      entityId: rideId,
      metadata: { disputeId: disputeRef.id, reason },
    });

    return { success: true, disputeId: disputeRef.id };
  },
);
