import { messaging } from './admin';
import { MulticastMessage } from 'firebase-admin/messaging';

/**
 * Envoie une notification de demande de course en haute priorité.
 * Android : fullScreenIntent via le canal voyaj_ride_request.
 * iOS : interruptionLevel: 'time-sensitive' (CallKit requis pour la priorité maximale).
 */
export async function sendRideRequestNotification(params: {
  fcmTokens: string[];
  rideId: string;
  passengerName: string;
  pickupAddress: string;
  distanceKm: number;
  priceEur: number;
}): Promise<void> {
  if (params.fcmTokens.length === 0) return;

  const message: MulticastMessage = {
    tokens: params.fcmTokens,
    // Data message (pas de notification block) pour contrôle total côté app
    data: {
      type: 'ride_request',
      rideId: params.rideId,
      passengerName: params.passengerName,
      pickupAddress: params.pickupAddress,
      distanceKm: params.distanceKm.toFixed(1),
      priceEur: params.priceEur.toFixed(2),
    },
    android: {
      priority: 'high',
      ttl: 90000, // 90 secondes = durée d'acceptance
      notification: {
        title: 'Nouvelle demande de course',
        body: `${params.passengerName} — ${params.pickupAddress}`,
        channelId: 'voyaj_ride_request',
        icon: 'ic_notification',
        color: '#4F46E5',
        // fullScreenIntent géré par flutter_local_notifications côté app
      },
    },
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
      payload: {
        aps: {
          alert: {
            title: 'Nouvelle demande de course',
            body: `${params.passengerName} — ${params.pickupAddress}`,
          },
          sound: 'default',
          badge: 1,
          'interruption-level': 'time-sensitive',
        },
      },
    },
  };

  const result = await messaging.sendEachForMulticast(message);
  if (result.failureCount > 0) {
    console.error(`FCM failures: ${result.failureCount}`, result.responses);
  }
}

/**
 * Notification générique (message, confirmation de course, etc.)
 */
export async function sendPushNotification(params: {
  fcmTokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  route?: string;
}): Promise<void> {
  if (params.fcmTokens.length === 0) return;

  const message: MulticastMessage = {
    tokens: params.fcmTokens,
    notification: {
      title: params.title,
      body: params.body,
    },
    data: {
      ...params.data,
      ...(params.route ? { route: params.route } : {}),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'voyaj_default',
        icon: 'ic_notification',
        color: '#4F46E5',
      },
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          sound: 'default',
          'interruption-level': 'active',
        },
      },
    },
  };

  await messaging.sendEachForMulticast(message);
}
