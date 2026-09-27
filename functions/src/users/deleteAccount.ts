import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/admin';
import { unauthenticated, failedPrecondition } from '../shared/errors';
import { writeAudit } from '../shared/audit';
import { getAuth } from 'firebase-admin/auth';

/**
 * Callable : supprime le compte utilisateur (RGPD).
 * - Marque le document Firestore comme supprimé (soft delete)
 * - Anonymise les données personnelles
 * - Supprime le compte Firebase Auth
 * Note: Les courses passées sont conservées pour la comptabilité (données anonymisées).
 */
export const deleteAccount = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;

    // Vérifier qu'il n'y a pas de course en cours
    const activeRidesSnap = await db.collection('rides')
      .where('driverId', '==', uid)
      .where('status', 'in', ['searching', 'accepted', 'pickup', 'in_progress'])
      .limit(1)
      .get();

    if (!activeRidesSnap.empty) {
      throw failedPrecondition('Impossible de supprimer le compte pendant une course active');
    }

    const activePassengerSnap = await db.collection('rides')
      .where('passengerId', '==', uid)
      .where('status', 'in', ['searching', 'accepted', 'pickup', 'in_progress'])
      .limit(1)
      .get();

    if (!activePassengerSnap.empty) {
      throw failedPrecondition('Impossible de supprimer le compte pendant une course active');
    }

    const now = FieldValue.serverTimestamp();

    // Anonymiser le profil (ne pas supprimer — conservation légale)
    await db.collection('users').doc(uid).update({
      displayName: 'Utilisateur supprimé',
      email: null,
      phoneNumber: null,
      photoURL: null,
      fcmToken: null,
      stripeCustomerId: null,
      stripeAccountId: null,
      isDeleted: true,
      deletedAt: now,
      updatedAt: now,
    });

    await writeAudit({
      action: 'user.suspended',
      actorId: uid,
      entityType: 'user',
      entityId: uid,
      metadata: { reason: 'account_deletion_requested' },
    });

    // Supprimer le compte Firebase Auth
    await getAuth().deleteUser(uid);

    return { success: true };
  },
);
