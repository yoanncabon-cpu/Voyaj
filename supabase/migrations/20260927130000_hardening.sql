-- ════════════════════════════════════════════════════════════════════════════
-- Durcissement suite aux « advisors » Supabase (sécurité + performance).
-- ════════════════════════════════════════════════════════════════════════════

-- 1. pg_net hors du schéma public (ses fonctions restent dans le schéma net).
drop extension if exists pg_net;
create extension pg_net with schema extensions;

-- 2. search_path figé sur les fonctions utilitaires.
alter function public.touch_updated_at() set search_path = public;
alter function public.haversine_km(float8, float8, float8, float8) set search_path = public;

-- 3. Profils publics : vue « security invoker » adossée à une fonction
--    security definer qui ne renvoie QUE les colonnes publiques.
drop view if exists public.public_profiles;
create or replace function public.public_profile_rows()
returns table (
  id uuid, name text, avatar_url text, bio text, rating numeric, ratings_count int,
  rides_count int, is_verified boolean, is_driver boolean, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select id, name, avatar_url, bio, rating, ratings_count, rides_count, is_verified, is_driver, created_at
  from public.profiles
  where deleted_at is null and auth.uid() is not null
$$;
create view public.public_profiles with (security_invoker = true) as
  select * from public.public_profile_rows();
revoke all on public.public_profiles from anon;
grant select on public.public_profiles to authenticated;

-- 4. Fonctions security definer : jamais exécutables par un visiteur anonyme.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    -- Fonctions de déclencheur : aucun rôle client n'a besoin de les appeler.
    if f.proname in ('handle_new_user', 'notify_message_webhook', 'on_message_inserted') then
      execute format('revoke all on function %s from authenticated', f.sig);
    end if;
  end loop;
end $$;
-- Utilisées par les policies RLS ou appelées par l'app : réservées aux connectés.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_participant(uuid) to authenticated;
grant execute on function public.has_booking_on(uuid) to authenticated;
grant execute on function public.drives_scheduled(uuid) to authenticated;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;
grant execute on function public.my_booking_code(uuid) to authenticated;
grant execute on function public.public_profile_rows() to authenticated;

-- 5. Position chauffeur : une seule policy de lecture (au lieu de deux).
drop policy if exists driver_loc_own on public.driver_locations;
drop policy if exists driver_loc_passenger on public.driver_locations;
create policy driver_loc_select on public.driver_locations
  for select to authenticated using (
    driver_id = auth.uid() or exists (
      select 1 from public.rides r
      where r.driver_id = driver_locations.driver_id
        and r.passenger_id = auth.uid()
        and r.status in ('accepted','pickup','in_progress'))
  );
create policy driver_loc_insert on public.driver_locations
  for insert to authenticated with check (driver_id = auth.uid());
create policy driver_loc_update on public.driver_locations
  for update to authenticated using (driver_id = auth.uid()) with check (driver_id = auth.uid());
create policy driver_loc_delete on public.driver_locations
  for delete to authenticated using (driver_id = auth.uid());

-- 6. Performance : auth.uid() évalué une fois par requête, pas par ligne.
do $$
declare
  p record;
  q text;
  c text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
  loop
    q := replace(replace(p.qual, '(SELECT auth.uid() AS uid)', 'auth.uid()'), 'auth.uid()', '(select auth.uid())');
    c := replace(replace(p.with_check, '(SELECT auth.uid() AS uid)', 'auth.uid()'), 'auth.uid()', '(select auth.uid())');
    if p.qual is not null and p.with_check is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', p.policyname, p.schemaname, p.tablename, q, c);
    elsif p.qual is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, q);
    else
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, c);
    end if;
  end loop;
end $$;
