-- ════════════════════════════════════════════════════════════════════════════
-- Voyaj — schéma initial
--
-- Principe de sécurité : le client ne modifie JAMAIS l'argent, les points,
-- les statuts de course, les vérifications ni les sanctions. Ces colonnes
-- sont écrites uniquement par les Edge Functions (clé service_role).
-- Côté client : lecture filtrée par RLS + quelques écritures bornées
-- (profil de base, messages, demandes de trajet, position chauffeur).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Schéma privé : non exposé par l'API REST (secrets, réglages internes).
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table app_private.settings (
  key   text primary key,
  value text not null
);
comment on table app_private.settings is
  'functions_url (https://<ref>.supabase.co/functions/v1) et webhook_secret, à remplir après création du projet.';

-- ─── Utilitaires ───────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Distance en km (Haversine), utilisée pour trouver les chauffeurs proches.
create or replace function public.haversine_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 language sql immutable as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- ─── Profils ───────────────────────────────────────────────────────────────
create table public.profiles (
  id                  uuid primary key references auth.users on delete cascade,
  name                text,
  phone               text unique,
  avatar_url          text,
  bio                 text,
  -- Protégé (écrit par les Edge Functions uniquement)
  rating              numeric(2,1) not null default 5.0,
  ratings_count       int not null default 0,
  rides_count         int not null default 0,
  points_balance      int not null default 0 check (points_balance >= 0),
  is_verified         boolean not null default false,
  verification_status text not null default 'none'
                      check (verification_status in ('none','pending','verified','rejected')),
  is_driver           boolean not null default false,
  is_suspended        boolean not null default false,
  warning_count       int not null default 0,
  is_admin            boolean not null default false,
  stripe_customer_id  text,
  stripe_account_id   text,
  stripe_payouts_enabled boolean not null default false,
  terms_accepted_at   timestamptz,
  deleted_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Profil créé automatiquement à l'inscription.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Vue publique : ce que les autres utilisateurs peuvent voir d'un profil.
create view public.public_profiles
with (security_invoker = false) as
  select id, name, avatar_url, bio, rating, ratings_count, rides_count,
         is_verified, is_driver, created_at
  from public.profiles
  where deleted_at is null;

-- ─── Véhicules (1 par chauffeur au MVP) ────────────────────────────────────
create table public.vehicles (
  owner_id      uuid primary key references public.profiles on delete cascade,
  make          text not null,
  model         text not null,
  plate         text not null unique,
  color         text,
  vehicle_type  text not null check (vehicle_type in ('citadine','berline','suv','break','utilitaire')),
  seats         int not null check (seats between 1 and 7),
  consumption_l_per_100km numeric(4,1),
  locked        boolean not null default false,  -- verrouillé après validation admin
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger vehicles_touch before update on public.vehicles
  for each row execute function public.touch_updated_at();

-- ─── Tarification (lue par les Edge Functions, modifiable par l'admin) ──────
create table public.pricing_config (
  id                   int primary key default 1 check (id = 1),
  fuel_price_eur_per_l numeric(4,2) not null default 1.85,
  wear_eur_per_km      numeric(4,3) not null default 0.12,
  fee_base_eur         numeric(4,2) not null default 1.00,
  fee_per_km_eur       numeric(4,3) not null default 0.02,
  fee_max_eur          numeric(4,2) not null default 4.00,
  consumption          jsonb not null default
    '{"citadine":5.5,"berline":6.5,"suv":8.0,"break":7.0,"utilitaire":10.0}',
  late_cancel_penalty_eur numeric(4,2) not null default 5.00,
  updated_at           timestamptz not null default now()
);
insert into public.pricing_config default values;

-- ─── Position des chauffeurs en ligne ──────────────────────────────────────
create table public.driver_locations (
  driver_id   uuid primary key references public.profiles on delete cascade,
  lat         float8 not null,
  lng         float8 not null,
  heading     float8,
  is_online   boolean not null default false,
  -- Destination du chauffeur (obligatoire pour recevoir des courses :
  -- garde-fou « partage de frais » contre la requalification en transport payant)
  dest_lat    float8,
  dest_lng    float8,
  dest_address text,
  updated_at  timestamptz not null default now()
);
create index driver_locations_online_idx on public.driver_locations (is_online, updated_at);

-- ─── Courses immédiates ────────────────────────────────────────────────────
create table public.rides (
  id                  uuid primary key default gen_random_uuid(),
  passenger_id        uuid not null references public.profiles,
  driver_id           uuid references public.profiles,
  status              text not null default 'awaiting_payment' check (status in (
                        'awaiting_payment','searching','accepted','pickup','in_progress',
                        'ended','confirmed','cancelled','passenger_absent','expired')),
  pickup_lat          float8 not null,
  pickup_lng          float8 not null,
  pickup_address      text not null,
  dest_lat            float8 not null,
  dest_lng            float8 not null,
  dest_address        text not null,
  distance_km         numeric(7,2) not null,
  price               jsonb not null,   -- PriceBreakdown (cf. _shared/pricing.ts)
  stripe_payment_intent_id text,
  stripe_transfer_id  text,
  vehicle_description text,
  cancelled_by        uuid,
  cancel_reason       text,
  has_dispute         boolean not null default false,
  created_at          timestamptz not null default now(),
  searching_at        timestamptz,
  accepted_at         timestamptz,
  arrived_at          timestamptz,
  started_at          timestamptz,
  ended_at            timestamptz,
  confirmed_at        timestamptz,
  cancelled_at        timestamptz,
  updated_at          timestamptz not null default now()
);
create index rides_passenger_idx on public.rides (passenger_id, created_at desc);
create index rides_driver_idx on public.rides (driver_id, created_at desc);
create index rides_status_idx on public.rides (status, created_at);
create trigger rides_touch before update on public.rides
  for each row execute function public.touch_updated_at();

-- Code de prise en charge : visible uniquement par le passager.
create table public.ride_secrets (
  ride_id     uuid primary key references public.rides on delete cascade,
  pickup_code text not null
);

-- Chauffeurs sollicités pour une course (ils peuvent alors la lire).
create table public.ride_offers (
  ride_id    uuid references public.rides on delete cascade,
  driver_id  uuid references public.profiles on delete cascade,
  distance_km numeric(6,2),
  created_at timestamptz not null default now(),
  primary key (ride_id, driver_id)
);

create table public.ratings (
  id         uuid primary key default gen_random_uuid(),
  ride_id    uuid not null,
  ride_kind  text not null check (ride_kind in ('instant','scheduled')),
  rater_id   uuid not null references public.profiles,
  rated_id   uuid not null references public.profiles,
  score      int not null check (score between 1 and 5),
  comment    text check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (ride_id, rater_id)
);

-- ─── Covoiturage programmé ─────────────────────────────────────────────────
create table public.scheduled_rides (
  id              uuid primary key default gen_random_uuid(),
  driver_id       uuid not null references public.profiles,
  origin_address  text not null,
  origin_lat      float8,
  origin_lng      float8,
  dest_address    text not null,
  dest_lat        float8,
  dest_lng        float8,
  departure_at    timestamptz not null,
  seats           int not null check (seats between 1 and 7),
  booked_seats    int not null default 0 check (booked_seats >= 0),
  distance_km     numeric(7,2) not null,
  price           jsonb not null,
  recurring_daily boolean not null default false,
  status          text not null default 'published'
                  check (status in ('published','full','completed','cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (booked_seats <= seats)
);
create index scheduled_rides_search_idx on public.scheduled_rides (status, departure_at);
create trigger scheduled_rides_touch before update on public.scheduled_rides
  for each row execute function public.touch_updated_at();

create table public.bookings (
  id               uuid primary key default gen_random_uuid(),
  scheduled_ride_id uuid not null references public.scheduled_rides on delete cascade,
  passenger_id     uuid not null references public.profiles,
  seats            int not null check (seats >= 1),
  amount_eur       numeric(8,2) not null,
  pickup_code      text not null,
  status           text not null default 'pending_payment'
                   check (status in ('pending_payment','confirmed','cancelled','completed')),
  stripe_payment_intent_id text,
  stripe_transfer_id text,
  penalty_eur      numeric(6,2) not null default 0,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index bookings_one_active_per_passenger
  on public.bookings (scheduled_ride_id, passenger_id)
  where status in ('pending_payment','confirmed');
create trigger bookings_touch before update on public.bookings
  for each row execute function public.touch_updated_at();

-- Demandes de trajet postées par des passagers (sans conducteur trouvé).
create table public.ride_requests (
  id              uuid primary key default gen_random_uuid(),
  passenger_id    uuid not null references public.profiles on delete cascade default auth.uid(),
  origin_address  text not null check (char_length(origin_address) between 2 and 200),
  dest_address    text not null check (char_length(dest_address) between 2 and 200),
  requested_date  date not null,
  status          text not null default 'open' check (status in ('open','closed')),
  created_at      timestamptz not null default now()
);

-- ─── Messagerie ────────────────────────────────────────────────────────────
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid not null references public.profiles on delete cascade,
  user_b      uuid not null references public.profiles on delete cascade,
  last_message text,
  last_message_at timestamptz,
  created_at  timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id       uuid not null references public.profiles default auth.uid(),
  content         text not null check (char_length(content) between 1 and 2000),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at);

create table public.user_blocks (
  blocker_id uuid references public.profiles on delete cascade default auth.uid(),
  blocked_id uuid references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create or replace function public.is_participant(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv and auth.uid() in (c.user_a, c.user_b)
  )
$$;

-- Ouvre (ou retrouve) la conversation avec un autre utilisateur.
create or replace function public.get_or_create_conversation(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a uuid; b uuid; conv uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if other is null or other = me then raise exception 'invalid_user'; end if;
  if exists (select 1 from public.user_blocks
             where (blocker_id = other and blocked_id = me)
                or (blocker_id = me and blocked_id = other)) then
    raise exception 'blocked';
  end if;
  a := least(me, other); b := greatest(me, other);
  insert into public.conversations (user_a, user_b) values (a, b)
    on conflict (user_a, user_b) do nothing;
  select id into conv from public.conversations where user_a = a and user_b = b;
  return conv;
end $$;

-- Met à jour l'aperçu de la conversation à chaque message.
create or replace function public.on_message_inserted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set last_message = left(new.content, 140), last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end $$;
create trigger messages_preview after insert on public.messages
  for each row execute function public.on_message_inserted();

-- ─── Litiges, points, récompenses ──────────────────────────────────────────
create table public.disputes (
  id          uuid primary key default gen_random_uuid(),
  ride_id     uuid not null,
  ride_kind   text not null check (ride_kind in ('instant','scheduled')),
  reporter_id uuid not null references public.profiles,
  reason      text not null check (reason in ('wrong_price','no_show_driver','no_show_passenger','safety','vehicle','other')),
  description text not null check (char_length(description) between 10 and 1000),
  status      text not null default 'open' check (status in ('open','in_review','resolved','rejected')),
  resolution  text,
  snapshot    jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index disputes_one_open_per_ride on public.disputes (ride_id) where status in ('open','in_review');

create table public.points_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  points     int not null,
  reason     text not null,
  entity_id  text,
  created_at timestamptz not null default now()
);

create table public.rewards (
  id          text primary key,
  title       text not null,
  description text,
  points_cost int not null check (points_cost > 0),
  icon        text,
  active      boolean not null default true
);
insert into public.rewards (id, title, points_cost, icon) values
  ('discount_10',    'Réduction 10 % sur une course', 50,  'pricetag'),
  ('premium_badge',  'Badge Premium',                  100, 'ribbon'),
  ('fuel_voucher_5', 'Bon carburant 5 €',              150, 'car'),
  ('free_ride',      '1 course offerte (≤ 10 €)',      200, 'gift');

create table public.redemptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  reward_id   text not null references public.rewards,
  code        text not null unique,
  points_spent int not null,
  status      text not null default 'issued' check (status in ('issued','used','expired')),
  created_at  timestamptz not null default now()
);

-- ─── « Je suis bien rentré » ───────────────────────────────────────────────
create table public.safe_returns (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  share_token text not null unique,
  lat         float8,
  lng         float8,
  status      text not null default 'active' check (status in ('active','arrived','expired')),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Notifications push (Expo) ─────────────────────────────────────────────
create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references public.profiles on delete cascade default auth.uid(),
  platform   text,
  updated_at timestamptz not null default now()
);

-- ─── Journaux ──────────────────────────────────────────────────────────────
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  action      text not null,
  actor_id    text,
  entity_type text not null,
  entity_id   text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create table public.stripe_events (
  id         text primary key,
  type       text not null,
  processed  boolean not null default false,
  error      text,
  created_at timestamptz not null default now()
);
