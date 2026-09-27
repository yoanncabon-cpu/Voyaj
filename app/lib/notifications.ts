import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

// Expo Go sur Android ne gère plus les notifications distantes (SDK 53+) et
// expo-notifications y affiche une erreur dès l'import : le module est donc
// chargé à la demande, jamais dans cette combinaison (même choix que la paroisse).
function pushUnsupported(): boolean {
  return Platform.OS === 'android' && Constants.appOwnership === 'expo';
}

let configured = false;
function notificationsModule() {
  const Notifications = require('expo-notifications') as typeof import('expo-notifications');
  if (!configured) {
    configured = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return Notifications;
}

/** Enregistre le jeton push Expo de l'appareil pour l'utilisateur connecté. */
export async function registerForPush(userId: string): Promise<string | null> {
  if (!Device.isDevice || pushUnsupported()) return null;
  const Notifications = notificationsModule();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Général',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    // Demandes de course : priorité maximale, son, vibration.
    await Notifications.setNotificationChannelAsync('ride-requests', {
      name: 'Demandes de course',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true },
    })).status;
  }
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await supabase.from('push_tokens').upsert({
    token, user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString(),
  });
  return token;
}

export async function unregisterPush(): Promise<void> {
  if (!Device.isDevice || pushUnsupported()) return;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const token = (await notificationsModule().getExpoPushTokenAsync({ projectId })).data;
    await supabase.from('push_tokens').delete().eq('token', token);
  } catch {
    // sans conséquence
  }
}

/** Ouvre la route portée par une notification touchée (ex. /driver/offer/123). */
export function subscribeToNotificationTaps(onRoute: (route: string) => void): () => void {
  if (pushUnsupported()) return () => {};
  const Notifications = notificationsModule();
  const handle = (response: import('expo-notifications').NotificationResponse | null) => {
    const route = response?.notification.request.content.data?.route;
    if (typeof route === 'string' && route.startsWith('/')) onRoute(route);
  };
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  return () => sub.remove();
}

/**
 * Notification reçue app ouverte : une demande de course ouvre directement
 * l'écran d'acceptation (le compte à rebours de 90 s tourne déjà).
 */
export function subscribeToForegroundRideRequests(onRoute: (route: string) => void): () => void {
  if (pushUnsupported()) return () => {};
  const Notifications = notificationsModule();
  const sub = Notifications.addNotificationReceivedListener((n) => {
    const data = n.request.content.data ?? {};
    if (data.type === 'ride_request' && typeof data.route === 'string') onRoute(data.route);
  });
  return () => sub.remove();
}
