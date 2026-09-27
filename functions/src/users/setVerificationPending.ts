import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/admin';
import { unauthenticated, failedPrecondition } from '../shared/errors';
import { writeAudit } from '../shared/audit';
import { sendPushNotification } from '../shared/fcm';

/**
 * Callable : marque la vérification d'identité comme "en attente de revue".
 * Déclenché après l'upload du document sur Firebase Storage.
 * L'admin reçoit une notification push pour effectuer la revue.
 */
export const setVerificationPending = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const user = userSnap.data() ?? {};

    if (user.isVerified === true) {
      throw failedPrecondition('Compte déjà vérifié');
    }
    if (user.verificationStatus === 'pending') {
      throw failedPrecondition('Vérification déjà en attente');
    }

    const now = FieldValue.serverTimestamp();
    await userRef.update({
      verificationStatus: 'pending',
      verificationSubmittedAt: now,
      updatedAt: now,
    });

    // Notifier les admins
    try {
      await sendPushNotification({
        topic: 'admin_verifications',
        title: '📋 Nouvelle vérification',
        body: `Utilisateur ${uid} a soumis ses documents`,
        data: { type: 'verification_pending', userId: uid },
      });
    } catch {
      // Silencieux si la notification échoue
    }

    await writeAudit({
      action: 'user.verified',
      actorId: uid,
      entityType: 'user',
      entityId: uid,
      metadata: { status: 'pending' },
    });

    return { success: true };
  },
);
