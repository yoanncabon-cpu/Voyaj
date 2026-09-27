import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db } from '../shared/admin';
import { sendPushNotification } from '../shared/fcm';

/**
 * Firestore trigger : réagit aux mises à jour du statut d'une course.
 * Notifie l'autre participant en temps réel.
 */
export const onRideStatusUpdated = onDocumentUpdated(
  {
    document: 'rides/{rideId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const rideId = event.params.rideId;

    if (!before || !after) return;
    if (before.status === after.status) return; // pas de changement de statut

    const { status, driverId, passengerId } = after;

    // Contenu de la notification selon le statut
    const notificationMap: Record<string, { toDriver: boolean; title: string; body: string }> = {
      accepted: {
        toDriver: false,
        title: 'Chauffeur trouvé !',
        body: 'Un chauffeur a accepté votre course',
      },
      pickup: {
        toDriver: false,
        title: 'Chauffeur arrivé',
        body: 'Le chauffeur est arrivé au point de départ. Montrez votre code.',
      },
      in_progress: {
        toDriver: false,
        title: 'Course démarrée',
        body: 'Bonne route !',
      },
      ended: {
        toDriver: false,
        title: 'Course terminée',
        body: 'Confirmez votre trajet pour valider le paiement.',
      },
      confirmed: {
        toDriver: true,
        title: 'Paiement confirmé',
        body: 'Le passager a confirmé la course. Votre gain est en route.',
      },
      cancelled: {
        toDriver: false,
        title: 'Course annulée',
        body: 'La course a été annulée.',
      },
      passenger_absent: {
        toDriver: false,
        title: 'Passager absent',
        body: 'Le chauffeur a signalé votre absence.',
      },
    };

    const notif = notificationMap[status];
    if (!notif) return;

    const targetUid = notif.toDriver ? driverId : passengerId;
    if (!targetUid) return;

    try {
      const userSnap = await db.collection('users').doc(targetUid).get();
      const user = userSnap.data();
      if (!user?.fcmToken) return;

      await sendPushNotification({
        fcmTokens: [user.fcmToken],
        title: notif.title,
        body: notif.body,
        data: { type: 'ride_status_update', rideId, status },
      });
    } catch (e) {
      console.error(`FCM notification failed for ride ${rideId}:`, e);
    }
  },
);

/**
 * Firestore trigger : réagit aux mises à jour d'une réservation programmée.
 */
export const onScheduledBookingUpdated = onDocumentUpdated(
  {
    document: 'scheduled_bookings/{bookingId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const bookingId = event.params.bookingId;

    if (!before || !after) return;
    if (before.status === after.status) return;

    const { status, passengerId, driverId, rideId } = after;

    if (status === 'cancelled') {
      // Notifier le chauffeur seulement si le passager a annulé
      if (after.cancelledBy === passengerId) {
        try {
          const driverSnap = await db.collection('users').doc(driverId).get();
          const driver = driverSnap.data();
          if (driver?.fcmToken) {
            await sendPushNotification({
              fcmTokens: [driver.fcmToken],
              title: 'Réservation annulée',
              body: 'Un passager a annulé sa réservation',
              data: { type: 'scheduled_booking_cancelled', rideId, bookingId },
            });
          }
        } catch (e) {
          console.error(`FCM notification failed for booking ${bookingId}:`, e);
        }
      }
    }
  },
);
