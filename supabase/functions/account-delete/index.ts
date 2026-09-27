// account-delete — Suppression du compte (RGPD, exigée par Apple et Google).
// Les données personnelles sont effacées ; les courses restent, anonymisées,
// pour les obligations comptables. Refusée pendant une course ou un trajet à venir.
import { adminClient, conflict, requireUser, serve } from '../_shared/http.ts';
import { audit } from '../_shared/domain.ts';

serve(async (req) => {
  const user = await requireUser(req);
  const db = adminClient();

  const { data: activeRide } = await db.from('rides').select('id')
    .or(`passenger_id.eq.${user.id},driver_id.eq.${user.id}`)
    .in('status', ['searching', 'accepted', 'pickup', 'in_progress', 'ended'])
    .limit(1);
  if (activeRide?.length) throw conflict('Terminez votre course en cours avant de supprimer votre compte');

  const { data: upcoming } = await db.from('scheduled_rides').select('id')
    .eq('driver_id', user.id).in('status', ['published', 'full']).gt('departure_at', new Date().toISOString()).limit(1);
  if (upcoming?.length) throw conflict('Annulez vos trajets publiés avant de supprimer votre compte');

  const { data: booked } = await db.from('bookings').select('id')
    .eq('passenger_id', user.id).eq('status', 'confirmed').limit(1);
  if (booked?.length) throw conflict('Annulez vos réservations avant de supprimer votre compte');

  // Fichiers personnels.
  for (const bucket of ['avatars', 'identity']) {
    const { data: files } = await db.storage.from(bucket).list(user.id);
    if (files?.length) await db.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
  }

  await Promise.all([
    db.from('push_tokens').delete().eq('user_id', user.id),
    db.from('driver_locations').delete().eq('driver_id', user.id),
    db.from('vehicles').delete().eq('owner_id', user.id),
    db.from('safe_returns').delete().eq('user_id', user.id),
    db.from('ride_requests').delete().eq('passenger_id', user.id),
  ]);

  await db.from('profiles').update({
    name: 'Compte supprimé', phone: null, avatar_url: null, bio: null,
    stripe_customer_id: null, deleted_at: new Date().toISOString(),
  }).eq('id', user.id);

  await audit(db, { action: 'user.deleted', actorId: user.id, entityType: 'user', entityId: user.id });

  // Le profil anonymisé est conservé (clé étrangère des courses) : on supprime
  // seulement l'identité de connexion.
  await db.auth.admin.deleteUser(user.id, true);
  return { success: true };
});
