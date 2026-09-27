// safe-return — « Je suis bien rentré ».
//   { action: 'start', lat, lng, hours? } → crée un lien de suivi public (4 h par défaut)
//   { action: 'update', lat, lng }        → met à jour la position
//   { action: 'arrived' }                 → « bien arrivé », le lien affiche la fin
import { adminClient, badRequest, conflict, num, requireUser, serve } from '../_shared/http.ts';
import { audit } from '../_shared/domain.ts';

const SITE = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://voyajapp.com';

function token(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

serve(async (req, body) => {
  const user = await requireUser(req);
  const db = adminClient();
  const action = String(body.action ?? '');

  const { data: active } = await db.from('safe_returns').select('*')
    .eq('user_id', user.id).eq('status', 'active').gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  switch (action) {
    case 'start': {
      const lat = num(body.lat, 'lat', -90, 90);
      const lng = num(body.lng, 'lng', -180, 180);
      const hours = body.hours == null ? 4 : num(body.hours, 'hours', 1, 12);
      if (active) await db.from('safe_returns').update({ status: 'expired' }).eq('id', active.id);
      const shareToken = token();
      const { data, error } = await db.from('safe_returns').insert({
        user_id: user.id, share_token: shareToken, lat, lng,
        expires_at: new Date(Date.now() + hours * 3_600_000).toISOString(),
      }).select('id, expires_at').single();
      if (error) throw error;
      await audit(db, { action: 'safe_return.started', actorId: user.id, entityType: 'safe_return', entityId: data.id });
      return { id: data.id, url: `${SITE}/jsbr/?t=${shareToken}`, expiresAt: data.expires_at };
    }
    case 'update': {
      if (!active) throw conflict('Aucun suivi en cours');
      await db.from('safe_returns').update({
        lat: num(body.lat, 'lat', -90, 90), lng: num(body.lng, 'lng', -180, 180), updated_at: new Date().toISOString(),
      }).eq('id', active.id);
      return { success: true };
    }
    case 'arrived': {
      if (!active) return { success: true };
      await db.from('safe_returns').update({ status: 'arrived', updated_at: new Date().toISOString() }).eq('id', active.id);
      return { success: true };
    }
    case 'status':
      return active
        ? { active: true, url: `${SITE}/jsbr/?t=${active.share_token}`, expiresAt: active.expires_at }
        : { active: false };
    default:
      throw badRequest('action invalide');
  }
});
