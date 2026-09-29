import { assert, assertEquals } from 'jsr:@std/assert@1';

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

Deno.test('pushToUsers : Expo vers Expo, FCM signé vers Firebase, jetons invalides supprimés', async () => {
  const keys = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  );
  const pkcs8 = b64(await crypto.subtle.exportKey('pkcs8', keys.privateKey)).match(/.{1,64}/g)!.join('\n');
  Deno.env.set('FCM_SERVICE_ACCOUNT', JSON.stringify({
    project_id: 'voyaj-test',
    client_email: 'push@voyaj-test.iam.gserviceaccount.com',
    private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----\n`,
  }));

  const calls: string[] = [];
  let jwtValid = false;
  let fcmBody: Record<string, any> | null = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      const assertion = new URLSearchParams(String(init?.body)).get('assertion')!;
      const [h, c, s] = assertion.split('.');
      jwtValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', keys.publicKey, fromB64url(s), new TextEncoder().encode(`${h}.${c}`));
      const claims = JSON.parse(new TextDecoder().decode(fromB64url(c)));
      assertEquals(claims.scope, 'https://www.googleapis.com/auth/firebase.messaging');
      return Response.json({ access_token: 'tok', expires_in: 3600 });
    }
    if (url.includes('fcm.googleapis.com/v1/projects/voyaj-test/messages:send')) {
      const body = JSON.parse(String(init?.body));
      if (body.message.token === 'fcm-perime') {
        return Response.json({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }, { status: 404 });
      }
      fcmBody = body;
      return Response.json({ name: 'ok' });
    }
    if (url.startsWith('https://exp.host/')) {
      const chunk = JSON.parse(String(init?.body));
      return Response.json({ data: chunk.map(() => ({ status: 'ok' })) });
    }
    throw new Error(`appel inattendu ${url}`);
  }) as typeof fetch;

  let deleted: string[] = [];
  const db = {
    from: () => ({
      select: () => ({ in: async () => ({ data: [{ token: 'ExponentPushToken[abc]' }, { token: 'fcm-ok' }, { token: 'fcm-perime' }] }) }),
      delete: () => ({ in: async (_col: string, values: string[]) => { deleted = values; return {}; } }),
    }),
  };

  try {
    const { pushToUsers } = await import('./push.ts');
    // deno-lint-ignore no-explicit-any
    await pushToUsers(db as any, ['u1'], { title: 'Nouvelle demande', body: '4,20 €', route: '/driver/offer/1', urgent: true });
  } finally {
    globalThis.fetch = realFetch;
  }

  assert(jwtValid, 'signature du JWT Google invalide');
  assertEquals(calls.filter((u) => u.startsWith('https://exp.host/')).length, 1);
  assertEquals(fcmBody!.message.token, 'fcm-ok');
  assertEquals(fcmBody!.message.data.route, '/driver/offer/1');
  assertEquals(fcmBody!.message.android.notification.channel_id, 'ride-requests');
  assertEquals(fcmBody!.message.android.ttl, '90s');
  assertEquals(deleted, ['fcm-perime']);
});
