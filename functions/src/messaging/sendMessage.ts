import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/admin';
import { sendPushNotification } from '../shared/fcm';
import { unauthenticated, invalidArgument, permissionDenied, failedPrecondition } from '../shared/errors';

interface SendMessageParams {
  recipientId: string;
  text: string;
  imageUrl?: string;
}

/**
 * Callable : envoie un message texte (avec modération basique).
 * Convention de l'ID de conversation : uid1_uid2 (uid1 < uid2 lexicographiquement).
 */
export const sendMessage = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const senderUid = request.auth.uid;
    const { recipientId, text, imageUrl } = request.data as SendMessageParams;

    if (!recipientId) throw invalidArgument('recipientId manquant');
    if (recipientId === senderUid) throw invalidArgument('Impossible de s\'écrire à soi-même');
    if (!text && !imageUrl) throw invalidArgument('Message vide');
    if (text && text.length > 2000) throw invalidArgument('Message trop long (max 2000 caractères)');

    // Vérifier que l'expéditeur n'est pas suspendu
    const senderDoc = await db.collection('users').doc(senderUid).get();
    if (!senderDoc.exists) throw failedPrecondition('Profil introuvable');
    if (senderDoc.data()?.isSuspended) throw permissionDenied('Compte suspendu');

    // Modération basique (à enrichir avec IA/regex ultérieurement)
    if (text) {
      const lowerText = text.toLowerCase();
      const bannedTerms = ['0033', '+33', 'whatsapp', 'viber', 'telegram'];
      if (bannedTerms.some(term => lowerText.includes(term))) {
        throw invalidArgument('Le partage de coordonnées personnelles est interdit');
      }
    }

    // Construction de l'ID de conversation
    const [id1, id2] = [senderUid, recipientId].sort();
    const conversationId = `${id1}_${id2}`;

    const now = FieldValue.serverTimestamp();
    const msgRef = db
      .collection('messages').doc(conversationId)
      .collection('messages').doc();

    await db.runTransaction(async (tx) => {
      // Créer ou mettre à jour la conversation
      const convRef = db.collection('messages').doc(conversationId);
      tx.set(convRef, {
        participants: [id1, id2],
        lastMessage: text ?? '📷 Image',
        lastMessageAt: now,
        updatedAt: now,
      }, { merge: true });

      // Ajouter le message
      tx.set(msgRef, {
        senderId: senderUid,
        recipientId,
        text: text ?? null,
        imageUrl: imageUrl ?? null,
        createdAt: now,
        readAt: null,
      });
    });

    // Notification push
    const recipientDoc = await db.collection('users').doc(recipientId).get();
    const recipient = recipientDoc.data();
    if (recipient?.fcmToken) {
      const sender = senderDoc.data();
      await sendPushNotification({
        fcmTokens: [recipient.fcmToken],
        title: sender?.firstName ?? 'Message',
        body: text ?? '📷 Image',
        data: { type: 'message', conversationId },
        route: `/messages/${recipientId}`,
      });
    }

    return { success: true, messageId: msgRef.id };
  },
);
