import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/admin';
import {
  unauthenticated, notFound, failedPrecondition, invalidArgument,
} from '../shared/errors';
import { writeAudit } from '../shared/audit';

interface RedeemPointsParams {
  rewardId: string;
}

/**
 * Callable : échange des points contre une récompense.
 * Vérifie le solde en transaction atomique pour éviter les doubles dépenses.
 */
export const redeemPoints = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const { rewardId } = request.data as RedeemPointsParams;

    if (!rewardId) throw invalidArgument('rewardId requis');

    // Charger la récompense
    const rewardSnap = await db.collection('rewards').doc(rewardId).get();
    if (!rewardSnap.exists) throw notFound('Récompense introuvable');

    const reward = rewardSnap.data()!;
    if (!reward.active) throw failedPrecondition('Récompense non disponible');

    const cost: number = reward.pointsCost ?? 0;
    if (cost <= 0) throw failedPrecondition('Récompense invalide');

    const userRef = db.collection('users').doc(uid);
    let redemptionCode: string | null = null;

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) throw notFound('Utilisateur introuvable');

      const user = userSnap.data()!;
      const currentBalance: number = user.pointsBalance ?? 0;

      if (currentBalance < cost) {
        throw failedPrecondition(
          `Solde insuffisant : ${currentBalance} pts disponibles, ${cost} pts requis`,
        );
      }

      // Déduire les points
      tx.update(userRef, {
        pointsBalance: FieldValue.increment(-cost),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Créer la transaction de points
      const txRef = db.collection('points_transactions').doc();
      tx.set(txRef, {
        userId: uid,
        points: -cost,
        reason: 'redemption',
        entityId: rewardId,
        rewardTitle: reward.title ?? rewardId,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Créer l'entrée de récompense
      const codeRef = db.collection('redemptions').doc();
      redemptionCode = `RWD-${uid.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      tx.set(codeRef, {
        userId: uid,
        rewardId,
        rewardTitle: reward.title ?? '',
        code: redemptionCode,
        pointsSpent: cost,
        status: 'issued',
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    await writeAudit({
      action: 'points.redeemed',
      actorId: uid,
      entityType: 'reward',
      entityId: rewardId,
      metadata: { pointsCost: cost, redemptionCode },
    });

    return { success: true, redemptionCode };
  },
);
