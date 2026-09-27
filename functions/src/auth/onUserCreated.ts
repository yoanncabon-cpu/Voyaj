import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { auth, db } from '../shared/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { writeAudit } from '../shared/audit';

/**
 * Trigger Firestore : initialise le profil complet + portefeuille + points
 * lorsqu'un nouveau document est créé dans /users/{uid}.
 * L'app crée d'abord le document utilisateur via Firestore (create autorisé par les rules),
 * ce trigger complète les données côté serveur.
 */
export const onUserProfileCreated = onDocumentCreated(
  { document: 'users/{uid}', region: 'europe-west1' },
  async (event) => {
    const uid = event.params.uid;
    const data = event.data?.data();
    if (!data) return;

    const now = FieldValue.serverTimestamp();

    // Initialiser le profil avec les valeurs par défaut
    await db.collection('users').doc(uid).update({
      rating: 5.0,
      ratingCount: 0,
      completedRides: 0,
      cancelledRides: 0,
      warningCount: 0,
      isSuspended: false,
      isDriver: false,
      isOnline: false,
      isVerified: false,
      verificationStatus: 'none',
      pointsBalance: 0,
      createdAt: now,
    });

    // Initialiser le document de points
    await db.collection('points').doc(uid).set({
      uid,
      balance: 0,
      totalEarned: 0,
      totalRedeemed: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Note : portefeuille non créé par défaut (feature_wallet_enabled = false au MVP)

    await writeAudit({
      action: 'user.created',
      actorId: uid,
      entityType: 'user',
      entityId: uid,
    });
  },
);

/**
 * Callable : définit les custom claims admin/merchant pour un utilisateur.
 * Réservé aux administrateurs (vérification du claim admin de l'appelant).
 */
import { onCall } from 'firebase-functions/v2/https';
import { permissionDenied, unauthenticated } from '../shared/errors';

export const setUserClaims = onCall(
  { region: 'europe-west1' },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    // Vérifier que l'appelant est admin
    const callerClaims = request.auth.token;
    if (!callerClaims.admin) throw permissionDenied('Admin uniquement');

    const { targetUid, isAdmin, isMerchant, merchantId } = request.data as {
      targetUid: string;
      isAdmin?: boolean;
      isMerchant?: boolean;
      merchantId?: string;
    };

    const claims: Record<string, unknown> = {};
    if (isAdmin != null) claims.admin = isAdmin;
    if (isMerchant != null) claims.merchant = isMerchant;
    if (merchantId) claims.merchantId = merchantId;

    await auth.setCustomUserClaims(targetUid, claims);

    await writeAudit({
      action: 'admin.action',
      actorId: request.auth.uid,
      entityType: 'user',
      entityId: targetUid,
      metadata: { claims },
    });

    return { success: true };
  },
);
