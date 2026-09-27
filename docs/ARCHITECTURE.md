# Voyaj — Architecture

Même stack que l'app de la paroisse : **Expo (React Native) + Supabase + EAS**.
Aucun Mac nécessaire : les builds iOS/Android et l'envoi sur TestFlight / Play se font dans le cloud EAS.

```
Voyaj APP/
├── app/          Application mobile Expo (SDK 54, expo-router, TypeScript)
├── supabase/     Backend : migrations SQL (schéma + RLS) et Edge Functions (Deno)
├── web/          Pages publiques : jsbr/ (suivi « bien rentré »), retour-app/ (relais Stripe)
└── docs/         Documentation
```

## Principe de sécurité

Le client ne modifie **jamais** l'argent, les points, les statuts de course, les vérifications ni les sanctions.

- **Row Level Security** sur toutes les tables ; droits d'écriture retirés au client sur les tables gérées par le serveur
  (testé : toute tentative est refusée).
- Profils : le client ne peut modifier que `name`, `phone`, `avatar_url`, `bio`, `terms_accepted_at` (droits par colonne).
- Toute action sensible passe par une **Edge Function** (clé `service_role`), qui vérifie le JWT de l'appelant.
- Code de prise en charge : table `ride_secrets` lisible seulement par le passager ; colonne `bookings.pickup_code` non lisible par le client
  (le passager passe par `my_booking_code()`).
- Appels internes (déclencheurs SQL, cron) : secret partagé `x-webhook-secret`, comparaison à temps constant.

## Argent (Stripe)

| Cas | Au moment de la demande | À la fin | Annulation |
|---|---|---|---|
| Course immédiate | Autorisation (capture manuelle) via PaymentSheet | Capture + transfert au chauffeur (confirmation passager ou d'office à 24 h) | Autorisation libérée ; pénalité (5 € par défaut) capturée et reversée au chauffeur si annulation tardive ou passager absent |
| Trajet programmé | Paiement immédiat à la réservation (places bloquées tout de suite) | Transfert au chauffeur 24 h après le départ, sauf litige | > 2 h avant : remboursement total ; < 2 h : pénalité retenue |

Chauffeurs : comptes **Stripe Connect Express** (`stripe-connect`). Webhook idempotent (`stripe-webhook`, table `stripe_events`).

## Prix (`supabase/functions/_shared/pricing.ts`, testé)

```
coût        = conso (L/100) × prix carburant × km  +  0,12 €/km
part        = coût / (places passagers + 1)        ← gain chauffeur, jamais de bénéfice
frais Voyaj = 1 € + 0,02 €/km, plafonné à 4 €
total       = part + frais
```
Paramètres modifiables dans la table `pricing_config` (carburant, usure, frais, consommations par type, pénalité).
Distance : Mapbox Directions si `MAPBOX_TOKEN` est défini, sinon vol d'oiseau × 1,3.

## Edge Functions

| Fonction | Rôle |
|---|---|
| `price-estimate` | Estimation affichée avant commande |
| `ride-request` → `ride-confirm-payment` | Création + autorisation carte → envoi aux chauffeurs proches (≤ 8 km, 10 max) |
| `ride-accept` | Le premier chauffeur qui accepte gagne (mise à jour conditionnelle atomique) |
| `ride-status` | arrive / start (code 4 chiffres + ≤ 150 m) / end / confirm / cancel / report_absent (après 5 min) |
| `ride-rate` | Note mutuelle (1 par personne et par trajet) |
| `scheduled-publish` / `scheduled-book` / `scheduled-book-confirm` / `scheduled-cancel` | Covoiturage programmé |
| `dispute-create` | Litige (suspend le virement automatique) |
| `stripe-connect`, `stripe-webhook` | Comptes chauffeurs, événements Stripe |
| `points-redeem` | Échange de points (débit atomique) |
| `vehicle-save`, `verification-submit`, `account-delete` | Profil chauffeur, vérification, suppression RGPD |
| `safe-return`, `safe-return-public` | « Je suis bien rentré » (lien public lu par `web/jsbr`) |
| `notify-message` | Push à chaque message (déclencheur SQL) |
| `maintenance` | Chaque minute (pg_cron) : expiration 90 s, confirmation d'office 24 h, places non payées, virements trajets, fin des suivis |

## Notifications

Service push **Expo** (comme la paroisse) : l'app enregistre son jeton dans `push_tokens`, le serveur appelle l'API Expo.
Pas de Firebase côté serveur. Canal Android `ride-requests` en priorité maximale ; iOS `time-sensitive`.
Android a quand même besoin d'un projet FCM (clé de compte de service déposée dans EAS) pour recevoir les push — comme la paroisse.

## Temps réel

Supabase Realtime sur `rides`, `driver_locations`, `messages`, `conversations`, `profiles`, `ride_offers` (filtré par la RLS).
Le chauffeur en ligne envoie sa position toutes les ~10 s tant que l'app est ouverte.
