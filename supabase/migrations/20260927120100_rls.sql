-- ════════════════════════════════════════════════════════════════════════════
-- Row Level Security — tout est fermé par défaut, puis ouvert au strict besoin.
-- Les Edge Functions utilisent la clé service_role et contournent la RLS.
-- ════════════════════════════════════════════════════════════════════════════

-- Aucun accès anonyme aux tables.
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

alter table public.profiles           enable row level security;
alter table public.vehicles           enable row level security;
alter table public.pricing_config     enable row level security;
alter table public.driver_locations   enable row level security;
alter table public.rides              enable row level security;
alter table public.ride_secrets       enable row level security;
alter table public.ride_offers        enable row level security;
alter table public.ratings            enable row level security;
alter table public.scheduled_rides    enable row level security;
alter table public.bookings           enable row level security;
alter table public.ride_requests      enable row level security;
alter table public.conversations      enable row level security;
alter table public.messages           enable row level security;
alter table public.user_blocks        enable row level security;
alter table public.disputes           enable row level security;
alter table public.points_transactions enable row level security;
alter table public.rewards            enable row level security;
alter table public.redemptions        enable row level security;
alter table public.safe_returns       enable row level security;
alter table public.push_tokens        enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.stripe_events      enable row level security;

-- ─── Profils ───────────────────────────────────────────────────────────────
-- Lecture : son propre profil complet. Les autres passent par public_profiles.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- Écriture : uniquement les colonnes « de confort ». Toutes les colonnes
-- sensibles (note, points, vérification, sanctions, Stripe…) sont exclues.
revoke update on public.profiles from authenticated;
grant update (name, phone, avatar_url, bio, terms_accepted_at) on public.profiles to authenticated;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

grant select on public.public_profiles to authenticated;

-- ─── Véhicules ─────────────────────────────────────────────────────────────
-- Écriture via l'Edge Function vehicle-save (validation + verrouillage).
create policy vehicles_select on public.vehicles
  for select to authenticated using (true);

-- ─── Tarifs / récompenses : lecture seule ──────────────────────────────────
create policy pricing_select on public.pricing_config
  for select to authenticated using (true);
create policy rewards_select on public.rewards
  for select to authenticated using (active);

-- ─── Position chauffeur ────────────────────────────────────────────────────
-- Le chauffeur écrit sa propre position (mise à jour fréquente, pas d'argent).
create policy driver_loc_own on public.driver_locations
  for all to authenticated
  using (driver_id = auth.uid())
  with check (driver_id = auth.uid());
-- Le passager voit la position de SON chauffeur pendant une course active.
create policy driver_loc_passenger on public.driver_locations
  for select to authenticated using (exists (
    select 1 from public.rides r
    where r.driver_id = driver_locations.driver_id
      and r.passenger_id = auth.uid()
      and r.status in ('accepted','pickup','in_progress')
  ));

-- ─── Courses immédiates : lecture seule côté client ────────────────────────
create policy rides_select on public.rides
  for select to authenticated using (
    passenger_id = auth.uid()
    or driver_id = auth.uid()
    or (status = 'searching' and exists (
      select 1 from public.ride_offers o
      where o.ride_id = rides.id and o.driver_id = auth.uid()))
    or public.is_admin()
  );

create policy ride_secrets_passenger on public.ride_secrets
  for select to authenticated using (exists (
    select 1 from public.rides r where r.id = ride_secrets.ride_id and r.passenger_id = auth.uid()
  ));

create policy ride_offers_own on public.ride_offers
  for select to authenticated using (driver_id = auth.uid());

create policy ratings_select on public.ratings
  for select to authenticated using (rater_id = auth.uid() or rated_id = auth.uid());

-- ─── Covoiturage programmé ─────────────────────────────────────────────────
-- Fonctions security definer : évitent la récursion entre les policies
-- de scheduled_rides et de bookings (chacune consulte l'autre table).
create or replace function public.has_booking_on(ride uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.bookings
                 where scheduled_ride_id = ride and passenger_id = auth.uid())
$$;
create or replace function public.drives_scheduled(ride uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.scheduled_rides
                 where id = ride and driver_id = auth.uid())
$$;

create policy scheduled_select on public.scheduled_rides
  for select to authenticated using (
    status in ('published','full') or driver_id = auth.uid() or public.has_booking_on(id)
  );

create policy bookings_select on public.bookings
  for select to authenticated using (
    passenger_id = auth.uid() or public.drives_scheduled(scheduled_ride_id)
  );

-- Le code de prise en charge ne doit pas fuiter vers le chauffeur :
-- lecture colonne par colonne, sans pickup_code.
revoke select on public.bookings from authenticated;
grant select (id, scheduled_ride_id, passenger_id, seats, amount_eur, status,
              penalty_eur, cancelled_at, created_at, updated_at)
  on public.bookings to authenticated;
-- Le passager récupère son code via my_booking_code().
create or replace function public.my_booking_code(booking uuid)
returns text language sql stable security definer set search_path = public as $$
  select pickup_code from public.bookings where id = booking and passenger_id = auth.uid()
$$;
grant execute on function public.my_booking_code(uuid) to authenticated;

create policy ride_requests_select on public.ride_requests
  for select to authenticated using (true);
create policy ride_requests_insert on public.ride_requests
  for insert to authenticated with check (passenger_id = auth.uid());
create policy ride_requests_update_own on public.ride_requests
  for update to authenticated using (passenger_id = auth.uid()) with check (passenger_id = auth.uid());
create policy ride_requests_delete_own on public.ride_requests
  for delete to authenticated using (passenger_id = auth.uid());

-- ─── Messagerie ────────────────────────────────────────────────────────────
create policy conversations_select on public.conversations
  for select to authenticated using (auth.uid() in (user_a, user_b));

create policy messages_select on public.messages
  for select to authenticated using (public.is_participant(conversation_id));
create policy messages_insert on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and public.is_participant(conversation_id)
    and not exists (
      select 1 from public.conversations c
      join public.user_blocks ub
        on ub.blocker_id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
       and ub.blocked_id = auth.uid()
      where c.id = messages.conversation_id)
  );
-- Marquer comme lu (seule colonne modifiable, et seulement les messages reçus).
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;
create policy messages_mark_read on public.messages
  for update to authenticated
  using (public.is_participant(conversation_id) and sender_id <> auth.uid())
  with check (public.is_participant(conversation_id) and sender_id <> auth.uid());

create policy blocks_own on public.user_blocks
  for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- ─── Litiges, points, récompenses, retour sécurisé ─────────────────────────
create policy disputes_own on public.disputes
  for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy points_own on public.points_transactions
  for select to authenticated using (user_id = auth.uid());
create policy redemptions_own on public.redemptions
  for select to authenticated using (user_id = auth.uid());
create policy safe_returns_own on public.safe_returns
  for select to authenticated using (user_id = auth.uid());

-- ─── Jetons push ───────────────────────────────────────────────────────────
create policy push_tokens_own on public.push_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit_logs, stripe_events : aucune policy → inaccessibles au client.

-- ─── Temps réel ────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.rides;
alter publication supabase_realtime add table public.driver_locations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- ─── Défense en profondeur ─────────────────────────────────────────────────
-- Même si une policy venait à être ajoutée par erreur, le client n'a pas le
-- droit d'écrire dans les tables gérées exclusivement par le serveur.
revoke insert, update, delete on
  public.vehicles, public.pricing_config, public.rides, public.ride_secrets,
  public.ride_offers, public.ratings, public.scheduled_rides, public.bookings,
  public.conversations, public.disputes, public.points_transactions,
  public.rewards, public.redemptions, public.safe_returns
from authenticated;
revoke all on public.audit_logs, public.stripe_events from authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke delete on public.messages from authenticated;
