// Notifications push via le service Expo (comme l'app paroisse) :
// pas de Firebase côté serveur, Expo relaie vers APNs / FCM.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

export interface PushMessage {
  title: string;
  body: string;
  /** Route expo-router ouverte au toucher (ex. /ride/123). */
  route?: string;
  data?: Record<string, string>;
  /** Demande de course : priorité max, son, catégorie à actions. */
  urgent?: boolean;
}

export async function pushToUsers(db: SupabaseClient, userIds: string[], msg: PushMessage): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  const { data: rows } = await db.from('push_tokens').select('token').in('user_id', ids);
  const tokens = (rows ?? []).map((r) => r.token as string);
  if (tokens.length === 0) return;

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
      console.error('push error', e);
    }
  }
  if (invalid.length) await db.from('push_tokens').delete().in('token', invalid);
}
