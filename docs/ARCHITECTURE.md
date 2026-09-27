# Voyaj — Architecture technique

## Vue d'ensemble

```
┌──────────────────────────────────────────────────────────┐
│                    CLIENTS                               │
│  Flutter Android  │  Flutter iOS  │  Admin Web  │  Pro Web│
└────────┬──────────┴──────┬────────┴──────┬──────┴────┬───┘
         │                 │               │           │
         └─────────────────┴───────────────┴───────────┘
                           │ HTTPS / WebSocket
         ┌─────────────────▼──────────────────────────────┐
         │                FIREBASE                        │
         │                                                │
         │  Auth (e-mail + SMS)    App Check (Play/Attest)│
         │  Firestore (données)    Realtime DB (présence) │
         │  Cloud Functions (logique métier)              │
         │  Cloud Tasks (timers)   Cloud Scheduler (cron) │
         │  FCM (push)             Storage (photos/docs)  │
         │  Remote Config          Crashlytics + Analytics│
         │  Hosting (admin, web, jsbr)                    │
         └───────────┬────────────────────────────────────┘
                     │ Secret Manager / env
         ┌───────────▼──────────────────────────────────────┐
         │              SERVICES TIERS                      │
         │  Stripe Connect (paiements + KYC chauffeurs)    │
         │  Mapbox (directions, geocoding, traffic)        │
         │  Fournisseur identité (Stripe Identity / Ubble) │
         │  Google Cloud Vision (OCR docs, SafeSearch)     │
         │  ADEME (consommation véhicules)                 │
         │  data.economie.gouv.fr (prix carburants)        │
         │  TURN servers (WebRTC pour les appels)          │
         │  E-mail (Brevo / Resend)                        │
         └──────────────────────────────────────────────────┘
```

## Firestore — Collections principales

```
/users/{uid}
  ├── profile (prénom, photo, note, isVerified, role)
  ├── private (email, phone, dob, stripeAccountId)   // lecture : owner + admin
  ├── vehicle (marque, modèle, plaque, consL100)      // lecture : owner + admin
  └── verification (status, reviewedAt, reviewedBy)  // écriture : functions only

/rides/{rideId}                    // course immédiate
  ├── status (enum : searching | matched | pickup | inProgress | done | cancelled | dispute)
  ├── driverId, passengerId
  ├── pickup (geohash, lat, lng)
  ├── destination (lat, lng, address)
  ├── priceBreakdown (fuel, wear, fee)
  ├── stripePaymentIntentId
  ├── tasks (acceptTaskId, waitTaskId, confirmTaskId)
  └── events[] (log immuable)

/scheduled_rides/{rideId}         // covoiturage programmé
/agreements/{agId}                // accords trajets réguliers
/messages/{conversationId}/messages/{msgId}
/safe_returns/{token}             // suivi « Je suis bien rentré »
/wallets/{uid}                    // portefeuille (feature-flaggé)
/wallet_codes/{codeId}            // codes de recharge
/points/{uid}                     // solde points + historique
/rewards/{rewardId}               // catalogue
/events/{eventId}                 // festivals, concerts
/disputes/{disputeId}
/notifications/{uid}/items/{id}
/merchant_partners/{merchantId}
/merchant_codes/{codeId}
/audit_logs/{id}                  // actions admin, immuables
/config/{doc}                     // clés Remote Config cachées si besoin
```

## Cloud Functions — Modules

| Module | Triggers | Rôle |
|--------|----------|------|
| `auth` | onCreate, onDelete | Création du document user, nettoyage |
| `rides/instant` | callable | Créer, accepter, arriver, prendre en charge, terminer, annuler, litige |
| `rides/scheduled` | callable | Publier, réserver, annuler, générer les trajets d'un accord |
| `rides/timers` | Cloud Tasks onTaskDispatched | Expiration 90 s, expiration attente 5 min, décision auto 2 min, confirmation 24 h |
| `rides/cron` | Cloud Scheduler | Génération nocturne des 14 jours glissants, prélèvements 24 h avant |
| `payment` | callable, Stripe webhook | Autoriser, capturer, rembourser, transférer, pénalité 5 € |
| `pricing` | appelé en interne | Calcul du prix : carburant + usure + frais |
| `identity` | Storage trigger, callable | Déclenchement vérification, mise à jour du statut |
| `moderation` | callable, Storage trigger | SafeSearch photos, signalements |
| `messaging` | callable | Envoyer message, supprimer, bloquer |
| `points` | appelé en interne | Crédit de points (après confirmation de course) |
| `rewards` | callable | Échanger des points contre une récompense |
| `events` | callable (admin) | CRUD événements |
| `notifications` | Firestore trigger | Deep links push via FCM |
| `safeReturn` | callable, cron | Créer un suivi, alerter après 90 min |
| `wallet` | callable | Créditer, débiter, recharger par code |
| `merchantPortal` | callable | Stock, ventes, relevés, commandes |
| `admin` | callable (admin claim) | Vérification manuelle, suspension, litiges, config |

## Règles de sécurité (principe)

- **Firestore** : aucune écriture client sur `rides`, `wallets`, `points`, `verification`. Seules les fonctions (service account) peuvent écrire sur ces collections.
- **Storage** : un utilisateur ne peut écrire que dans `uploads/{uid}/`, lecture publique interdite sauf `photos/{uid}/profile` signée.
- **App Check** : activé en prod (Play Integrity sur Android, App Attest sur iOS). Les functions callable le vérifient.

## Paiement — Flux détaillés

### Course immédiate
```
Passager demande → Function `createRide` → Stripe authorize (capture=manual)
  → Si échec paiement : ride annulée, passager et chauffeur notifiés
  → Si succès : Cloud Task "expiration 90s" créé
Chauffeur accepte → `acceptRide` → Cloud Task annulé
  → Service de premier plan chauffeur : navigation
Chauffeur arrive → `driverArrived` (vérifié GPS < 150m) → Cloud Task "5 min passager"
Passager monte → `confirmPickup` (code 4 chiffres) → Cloud Task annulé
Fin de course → `endRide` (chauffeur) → passager confirme (ou 24h auto)
  → Confirmation : Stripe capture → Stripe transfer au chauffeur → points crédités
  → Dispute : argent conservé, admin examine
```

### Trajet programmé
```
Chauffeur publie → `publishScheduledRide`
Passager réserve → `bookRide` → Stripe charge immédiate
24h avant → Cloud Scheduler → Stripe charge (MIT off-session si accordé)
Annulation chauffeur < 2h → `cancelRide` → remboursement + Stripe prélève 5€ au chauffeur
```

## CI/CD

| Workflow | Trigger | Actions |
|----------|---------|---------|
| `ci.yml` | push / PR | lint Dart, tests Flutter, tests Functions, tests règles Firestore |
| `deploy_functions.yml` | push main | `firebase deploy --only functions,firestore,storage` (staging puis prod avec approbation) |
| `ios_build.yml` | tag `ios-*` | build Xcode sur runner macOS, archive, TestFlight |
| `android_build.yml` | tag `android-*` | `flutter build appbundle --release`, upload Play Store (track internal) |

## Environnements

| Env | Firebase project | Usage |
|-----|-----------------|-------|
| dev | `voyaj-dev` | Dev local, émulateurs |
| staging | `voyaj-staging` | Tests intégration, TestFlight bêta |
| prod | `voyaj-prod` | Production |
