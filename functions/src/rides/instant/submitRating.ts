import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../shared/admin';
import {
  unauthenticated, notFound, failedPrecondition, invalidArgument, permissionDenied,
} from '../../shared/errors';
import { writeAudit } from '../../shared/audit';

interface SubmitRatingParams {
  rideId: string;
  rating: number;   // 1–5
  comment?: string;
}

/**
 * Callable : soumet une note après une course.
 * Chaque participant peut noter l'autre une seule fois.
 * Quand les deux ont noté, la moyenne est calculée et mise à jour sur le profil.
 */
export const submitRating = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const { rideId, rating, comment } = request.data as SubmitRatingParams;

    if (!rideId) throw invalidArgument('rideId requis');
    if (!rating || rating < 1 || rating > 5) {
      throw invalidArgument('rating doit être entre 1 et 5');
    }

    const rideRef = db.collection('rides').doc(rideId);
    const rideSnap = await rideRef.get();
    if (!rideSnap.exists) throw notFound('Course introuvable');

    const ride = rideSnap.data()!;

    const isDriver = ride.driverId === uid;
    const isPassenger = ride.passengerId === uid;
    if (!isDriver && !isPassenger) throw permissionDenied('Non participant');

    if (!['ended', 'confirmed'].includes(ride.status)) {
      throw failedPrecondition('La course doit être terminée pour noter');
    }

    // Champ spécifique à la position (chauffeur rate le passager, passager rate le chauffeur)
    const ratingField = isDriver ? 'driverRating' : 'passengerRating';
    const ratedUid = isDriver ? ride.passengerId : ride.driverId;

    if (ride[ratingField] != null) {
      throw failedPrecondition('Vous avez déjà noté cette course');
    }

    const now = FieldValue.serverTimestamp();
    await rideRef.update({
      [ratingField]: rating,
      [`${ratingField}Comment`]: comment ?? null,
      [`${ratingField}At`]: now,
      updatedAt: now,
    });

    // Mise à jour de la note moyenne sur le profil de l'utilisateur noté
    await updateUserRating(ratedUid, rating);

    // Attribution de points Voyaj (10 pts pour avoir noté)
    await awardPoints(uid, 10, 'rating_submitted', rideId);

    await writeAudit({
      action: 'ride.confirmed',
      actorId: uid,
      entityType: 'ride',
      entityId: rideId,
      metadata: { rating, ratedUserId: ratedUid, role: isDriver ? 'driver' : 'passenger' },
    });

    return { success: true };
  },
);

async function updateUserRating(userId: string, newRating: number): Promise<void> {
  const userRef = db.collection('users').doc(userId);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return;

    const user = userSnap.data()!;
    const currentCount: number = user.ratingsCount ?? 0;
    const currentAvg: number = user.rating ?? 5.0;

    const newCount = currentCount + 1;
    const newAvg = (currentAvg * currentCount + newRating) / newCount;

    tx.update(userRef, {
      rating: Math.round(newAvg * 10) / 10,
      ratingsCount: newCount,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  entityId: string,
): Promise<void> {
  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    pointsBalance: FieldValue.increment(points),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection('points_transactions').add({
    userId,
    points,
    reason,
    entityId,
    createdAt: FieldValue.serverTimestamp(),
  });

  await writeAudit({
    action: 'points.awarded',
    actorId: userId,
    entityType: 'user',
    entityId: userId,
    metadata: { points, reason, entityId },
  });
}
