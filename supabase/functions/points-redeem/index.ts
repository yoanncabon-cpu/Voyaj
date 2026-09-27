// points-redeem — Échange de points contre une récompense.
// Débit atomique (spend_points) : impossible de dépenser deux fois les mêmes points.
//
// Entrée : { rewardId }
import { adminClient, assertNotSuspended, badRequest, conflict, getProfile, notFound, requireUser, serve } from '../_shared/http.ts';
import { audit } from '../_shared/domain.ts';

function redemptionCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return 'VJ-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

serve(async (req, body) => {
  const user = await requireUser(req);
  const rewardId = String(body.rewardId ?? '');
  if (!/^[a-z0-9_]{2,40}$/.test(rewardId)) throw badRequest('rewardId invalide');
  const db = adminClient();
  assertNotSuspended(await getProfile(db, user.id));

  const { data: reward } = await db.from('rewards').select('*').eq('id', rewardId).eq('active', true).maybeSingle();
  if (!reward) throw notFound('Récompense indisponible');

  const { data: ok } = await db.rpc('spend_points', { uid: user.id, cost: reward.points_cost });
  if (!ok) throw conflict('Solde de points insuffisant');

  const code = redemptionCode();
  await db.from('points_transactions').insert({ user_id: user.id, points: -reward.points_cost, reason: 'redemption', entity_id: rewardId });
  await db.from('redemptions').insert({ user_id: user.id, reward_id: rewardId, code, points_spent: reward.points_cost });
  await audit(db, { action: 'points.redeemed', actorId: user.id, entityType: 'reward', entityId: rewardId, metadata: { code } });
  return { code, title: reward.title };
});
