// safe-return-public — Lecture PUBLIQUE d'un suivi « bien rentré » par son jeton.
// Appelée par la page web voyajapp.com/jsbr (sans compte). Déployée avec
// --no-verify-jwt. Ne renvoie que le prénom, la position et l'état.
import { adminClient, corsHeaders, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const t = new URL(req.url).searchParams.get('t') ?? '';
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(t)) return json({ error: 'invalid_token' }, 400);

  const db = adminClient();
  const { data } = await db.from('safe_returns')
    .select('user_id, lat, lng, status, expires_at, updated_at').eq('share_token', t).maybeSingle();
  if (!data) return json({ error: 'not_found' }, 404);

  const expired = data.status === 'active' && new Date(data.expires_at).getTime() < Date.now();
  const { data: profile } = await db.from('profiles').select('name').eq('id', data.user_id).single();
  const firstName = (profile?.name ?? 'Votre proche').split(' ')[0];

  return new Response(JSON.stringify({
    name: firstName,
    status: expired ? 'expired' : data.status,
    // Après l'arrivée ou l'expiration, la position n'est plus partagée.
    lat: data.status === 'active' && !expired ? data.lat : null,
    lng: data.status === 'active' && !expired ? data.lng : null,
    updatedAt: data.updated_at,
    expiresAt: data.expires_at,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
});
