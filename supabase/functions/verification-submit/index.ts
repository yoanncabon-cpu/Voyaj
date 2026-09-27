// verification-submit — Le document d'identité a été déposé dans le bucket
// privé « identity/<uid>/ » : passage en « pending » et alerte à l'admin,
// qui valide ou refuse manuellement (revue humaine au MVP).
import { adminClient, conflict, requireUser, serve } from '../_shared/http.ts';
import { audit } from '../_shared/domain.ts';
import { pushToUsers } from '../_shared/push.ts';

serve(async (req) => {
  const user = await requireUser(req);
  const db = adminClient();

  const { data: profile } = await db.from('profiles').select('is_verified, verification_status').eq('id', user.id).single();
  if (profile?.is_verified) throw conflict('Compte déjà vérifié');
  if (profile?.verification_status === 'pending') return { status: 'pending' };

  const { data: files } = await db.storage.from('identity').list(user.id, { limit: 10 });
  if (!files?.length) throw conflict('Aucun document reçu. Réessayez l\'envoi.');

  await db.from('profiles').update({ verification_status: 'pending' }).eq('id', user.id);

  const { data: admins } = await db.from('profiles').select('id').eq('is_admin', true);
  await pushToUsers(db, (admins ?? []).map((a) => a.id), {
    title: 'Vérification à traiter',
    body: `${files.length} document(s) envoyé(s)`,
    route: '/admin/verifications',
  });
  await audit(db, { action: 'user.verification_submitted', actorId: user.id, entityType: 'user', entityId: user.id });
  return { status: 'pending' };
});
