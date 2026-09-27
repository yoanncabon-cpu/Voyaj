-- ════════════════════════════════════════════════════════════════════════════
-- Appels base → Edge Functions (même principe que l'app paroisse) :
-- pg_net poste vers la fonction avec un secret partagé (x-webhook-secret).
--
-- À faire UNE FOIS après création du projet (SQL editor) :
--   insert into app_private.settings values
--     ('functions_url', 'https://<ref>.supabase.co/functions/v1'),
--     ('webhook_secret', '<même valeur que le secret WEBHOOK_SECRET des fonctions>');
-- ════════════════════════════════════════════════════════════════════════════

create or replace function app_private.call_function(fn text, payload jsonb)
returns void language plpgsql security definer set search_path = public, app_private as $$
declare
  base   text := (select value from app_private.settings where key = 'functions_url');
  secret text := (select value from app_private.settings where key = 'webhook_secret');
begin
  if base is null or secret is null then
    raise warning 'app_private.settings incomplet : appel % ignoré', fn;
    return;
  end if;
  perform net.http_post(
    base || '/' || fn,
    payload,
    '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    5000
  );
end $$;
revoke all on function app_private.call_function(text, jsonb) from public;

-- Nouveau message → push au destinataire.
create or replace function public.notify_message_webhook()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform app_private.call_function('notify-message', jsonb_build_object('record', to_jsonb(new)));
  return new;
end $$;
create trigger notify_on_new_message after insert on public.messages
  for each row execute function public.notify_message_webhook();

-- Tâche de fond chaque minute : expirations 90 s, confirmation d'office 24 h,
-- fin des retours sécurisés, clôture des trajets programmés passés.
select cron.schedule(
  'voyaj-maintenance',
  '* * * * *',
  $$ select app_private.call_function('maintenance', '{}'::jsonb) $$
);
