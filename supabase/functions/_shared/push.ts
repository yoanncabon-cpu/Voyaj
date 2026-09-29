// Notifications push :
// - app Expo (iPhone) : jetons « ExponentPushToken[…] », relayés par le service Expo vers APNs / FCM ;
// - app Flutter (Android) : jetons FCM bruts, envoyés directement à Firebase Cloud Messaging (API HTTP v1).
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');
// JSON complet de la clé de compte de service Firebase (Paramètres du projet → Comptes de service).
const FCM_SERVICE_ACCOUNT = Deno.env.get('FCM_SERVICE_ACCOUNT');

export interface PushMessage {
  title: string;
  body: string;
  /** Route ouverte au toucher (ex. /ride/123), transmise dans data.route. */
  route?: string;
  data?: Record<string, string>;
  /** Demande de course : priorité max, son, catégorie à actions. */
  urgent?: boolean;
}

const isExpoToken = (t: string) => t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[');

export async function pushToUsers(db: SupabaseClient, userIds: string[], msg: PushMessage): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  const { data: rows } = await db.from('push_tokens').select('token').in('user_id', ids);
  const tokens = (rows ?? []).map((r) => r.token as string);
  if (tokens.length === 0) return;

  const [expoInvalid, fcmInvalid] = await Promise.all([
    sendExpo(tokens.filter(isExpoToken), msg),
    sendFcm(tokens.filter((t) => !isExpoToken(t)), msg),
  ]);
  const invalid = [...expoInvalid, ...fcmInvalid];
  if (invalid.length) await db.from('push_tokens').delete().in('token', invalid);
}

async function sendExpo(tokens: string[], msg: PushMessage): Promise<string[]> {
  const messages = tokens.map((to) => ({
    to,
    title: msg.title,
    body: msg.body,
    sound: 'default',
    priority: 'high',
    channelId: msg.urgent ? 'ride-requests' : 'default',
    interruptionLevel: msg.urgent ? 'time-sensitive' : 'active',
    ttl: msg.urgent ? 90 : undefined,
    data: { ...(msg.data ?? {}), ...(msg.route ? { route: msg.route } : {}) },
  }));

  const invalid: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const resp = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(chunk),
      });
      const decoded = await resp.json().catch(() => ({}));
      const tickets: Array<{ status: string; details?: { error?: string } }> = decoded?.data ?? [];
      tickets.forEach((t, j) => {
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') invalid.push(chunk[j].to);
      });
    } catch (e) {
      console.error('push expo error', e);
    }
  }
  return invalid;
}

// ─── Firebase Cloud Messaging (HTTP v1) ─────────────────────────────────────

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let fcmAuth: { token: string; exp: number } | null = null;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Jeton OAuth Google obtenu en signant un JWT avec la clé du compte de service (valable 1 h, mis en cache). */
async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (fcmAuth && fcmAuth.exp > now + 60) return fcmAuth.token;

  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = b64url(enc.encode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })));
  const unsigned = `${header}.${claims}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned)));

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${b64url(signature)}`,
    }),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`fcm oauth ${resp.status} ${json.error ?? ''}`);
  fcmAuth = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return fcmAuth.token;
}

async function sendFcm(tokens: string[], msg: PushMessage): Promise<string[]> {
  if (tokens.length === 0) return [];
  if (!FCM_SERVICE_ACCOUNT) {
    console.warn(`push fcm ignoré : secret FCM_SERVICE_ACCOUNT absent (${tokens.length} jeton(s))`);
    return [];
  }

  let sa: ServiceAccount;
  let access: string;
  try {
    sa = JSON.parse(FCM_SERVICE_ACCOUNT);
    access = await fcmAccessToken(sa);
  } catch (e) {
    console.error('push fcm auth error', e);
    return [];
  }

  // FCM n'accepte que des chaînes dans « data ».
  const data: Record<string, string> = { ...(msg.data ?? {}), ...(msg.route ? { route: msg.route } : {}) };
  const invalid: string[] = [];

  await Promise.all(tokens.map(async (token) => {
    try {
      const resp = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}` },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: msg.title, body: msg.body },
            data,
            android: {
              priority: 'HIGH',
              ...(msg.urgent ? { ttl: '90s' } : {}),
              notification: { channel_id: msg.urgent ? 'ride-requests' : 'default', sound: 'default' },
            },
          },
        }),
      });
      if (resp.ok) return;
      const err = await resp.json().catch(() => ({}));
      const code = JSON.stringify(err?.error?.details ?? []) + (err?.error?.status ?? '');
      // Jeton périmé (app désinstallée) ou mal formé : on le supprime.
      if (resp.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(code)) invalid.push(token);
      else console.error('push fcm error', resp.status, err?.error?.message);
    } catch (e) {
      console.error('push fcm error', e);
    }
  }));
  return invalid;
}
