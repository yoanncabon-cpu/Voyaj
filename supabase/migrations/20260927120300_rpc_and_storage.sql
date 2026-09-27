-- ════════════════════════════════════════════════════════════════════════════
-- Fonctions atomiques appelées par les Edge Functions (service_role seulement)
-- + stockage des fichiers (avatars publics, pièces d'identité privées).
-- ════════════════════════════════════════════════════════════════════════════

-- Points : incrément atomique, jamais négatif (contrainte sur la colonne).
create or replace function public.increment_points(uid uuid, delta int)
returns int language sql security definer set search_path = public as $$
  update public.profiles set points_balance = points_balance + delta
  where id = uid returning points_balance
$$;

-- Débit de points si le solde suffit ; renvoie false sinon (anti double dépense).
create or replace function public.spend_points(uid uuid, cost int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set points_balance = points_balance - cost
  where id = uid and points_balance >= cost;
  return found;
end $$;

-- Note moyenne : recalcul atomique.
create or replace function public.apply_rating(uid uuid, score int)
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set rating = round(((rating * ratings_count) + score)::numeric / (ratings_count + 1), 1),
         ratings_count = ratings_count + 1
   where id = uid
$$;

create or replace function public.increment_rides(uid uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles set rides_count = rides_count + 1 where id = uid
$$;

-- Réserve n places si disponibles (pas de survente même en concurrence).
create or replace function public.reserve_seats(ride uuid, n int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.scheduled_rides
     set booked_seats = booked_seats + n,
         status = case when booked_seats + n >= seats then 'full' else status end
   where id = ride and status = 'published' and booked_seats + n <= seats
     and departure_at > now();
  return found;
end $$;

create or replace function public.release_seats(ride uuid, n int)
returns void language sql security definer set search_path = public as $$
  update public.scheduled_rides
     set booked_seats = greatest(booked_seats - n, 0),
         status = case when status = 'full' then 'published' else status end
   where id = ride
$$;

-- Chauffeurs en ligne, vérifiés, avec véhicule, position fraîche (< 2 min),
-- triés par distance au point de prise en charge.
create or replace function public.nearby_drivers(p_lat float8, p_lng float8, radius_km float8, max_count int, exclude uuid)
returns table (driver_id uuid, distance_km float8)
language sql stable security definer set search_path = public as $$
  select d.driver_id, public.haversine_km(p_lat, p_lng, d.lat, d.lng) as distance_km
  from public.driver_locations d
  join public.profiles p on p.id = d.driver_id
  join public.vehicles v on v.owner_id = d.driver_id
  where d.is_online
    and d.updated_at > now() - interval '2 minutes'
    and p.is_verified and not p.is_suspended and p.deleted_at is null
    and d.driver_id <> exclude
    -- pas déjà en course
    and not exists (select 1 from public.rides r
                    where r.driver_id = d.driver_id
                      and r.status in ('accepted','pickup','in_progress'))
    and public.haversine_km(p_lat, p_lng, d.lat, d.lng) <= radius_km
  order by distance_km
  limit max_count
$$;

-- Réservées au serveur.
revoke all on function public.increment_points(uuid, int) from public, anon, authenticated;
revoke all on function public.spend_points(uuid, int) from public, anon, authenticated;
revoke all on function public.apply_rating(uuid, int) from public, anon, authenticated;
revoke all on function public.increment_rides(uuid) from public, anon, authenticated;
revoke all on function public.reserve_seats(uuid, int) from public, anon, authenticated;
revoke all on function public.release_seats(uuid, int) from public, anon, authenticated;
revoke all on function public.nearby_drivers(float8, float8, float8, int, uuid) from public, anon, authenticated;
grant execute on function public.increment_points(uuid, int) to service_role;
grant execute on function public.spend_points(uuid, int) to service_role;
grant execute on function public.apply_rating(uuid, int) to service_role;
grant execute on function public.increment_rides(uuid) to service_role;
grant execute on function public.reserve_seats(uuid, int) to service_role;
grant execute on function public.release_seats(uuid, int) to service_role;
grant execute on function public.nearby_drivers(float8, float8, float8, int, uuid) to service_role;

-- ─── Stockage ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',  'avatars',  true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('identity', 'identity', false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

-- Chacun écrit uniquement dans son dossier : <bucket>/<uid>/...
create policy avatars_read on storage.objects
  for select to authenticated using (bucket_id = 'avatars');
create policy avatars_write_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Pièces d'identité : dépôt par l'intéressé, lecture par lui et par l'admin.
create policy identity_write_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'identity' and (storage.foldername(name))[1] = auth.uid()::text);
create policy identity_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'identity' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
