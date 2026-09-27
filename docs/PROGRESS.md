# Voyaj — Journal de progression

> Dernière mise à jour : 2026-09-27

## ✅ Fondations (fait)

### Infrastructure & config
- [x] Dossier projet créé : `Voyaj APP/`
- [x] `.gitignore` complet (Flutter, Firebase, secrets)
- [x] `INSTALL.ps1` — script d'installation one-shot (Flutter, JDK 17, Firebase CLI, gh)
- [x] `docs/ARCHITECTURE.md` — architecture complète (collections, modules, CI)
- [x] `docs/DECISIONS.md` — journal des décisions techniques
- [x] `docs/A_VERIFIER.md` — checklist légale / Remote Config flags
- [x] `PROMPT_VOYAJ.md` — master prompt pour nouvelles sessions Claude Code

### Firebase
- [x] `firebase/firestore.rules` — règles complètes (aucune écriture client sur argent/statut)
- [x] `firebase/storage.rules` — règles Storage par dossier
- [x] `firebase/firestore.indexes.json` — index composites pour toutes les requêtes prévues
- [x] `firebase/firebase.json` — config Hosting, emulateurs

### Cloud Functions
- [x] `functions/package.json` + `functions/tsconfig.json` + `.eslintrc.json`
- [x] `functions/src/shared/admin.ts` — initialisation Firebase Admin
- [x] `functions/src/shared/errors.ts` — helpers HttpsError
- [x] `functions/src/shared/audit.ts` — journal d'audit immuable
- [x] `functions/src/shared/pricing.ts` — moteur de prix (formule spec + tests)
- [x] `functions/src/shared/stripe.ts` — wrappers Stripe (authorize, capture, refund, transfer)
- [x] `functions/src/shared/fcm.ts` — notifications FCM (ride request, generic)
- [x] `functions/src/shared/pricing.test.ts` — tests unitaires prix
- [x] `functions/src/auth/onUserCreated.ts` — trigger création profil, setUserClaims admin
- [x] `functions/src/rides/instant/requestRide.ts` — demande de course
- [x] `functions/src/rides/instant/acceptRide.ts` — acceptation + Stripe authorize + code
- [x] `functions/src/rides/instant/updateRideStatus.ts` — toutes transitions d'état
- [x] `functions/src/rides/instant/updateDriverLocation.ts` — GPS chauffeur en ligne
- [x] `functions/src/rides/instant/autoConfirmRide.ts` — cron confirmation 24 h
- [x] `functions/src/rides/scheduled/publishScheduledRide.ts` — publication trajet
- [x] `functions/src/messaging/sendMessage.ts` — envoi message avec modération
- [x] `functions/src/safe_return/safeReturn.ts` — Je suis bien rentré
- [x] `functions/src/index.ts` — exports centralisés

### Mobile Flutter
- [x] `mobile/pubspec.yaml` — toutes les dépendances
- [x] `mobile/lib/main.dart` — bootstrap (Firebase, Crashlytics, FCM bg handler)
- [x] `mobile/lib/firebase_options.dart` — placeholder (à remplir via flutterfire configure)
- [x] `mobile/lib/shared/theme/app_theme.dart` — Material 3, couleurs Voyaj, Inter
- [x] `mobile/lib/shared/constants/app_constants.dart` — toutes les constantes métier
- [x] `mobile/lib/shared/router/app_router.dart` — go_router complet (34 routes)
- [x] `mobile/lib/shared/providers/auth_provider.dart` — authState, currentUid, themeMode
- [x] `mobile/lib/shared/firebase/fcm_service.dart` — canaux Android, notifications
- [x] **34 écrans placeholder** créés dans toutes les features
- [x] `HomeScaffold` avec NavigationBar
- [x] `DisputeScreen` (paramétré rideId)

### Android
- [x] `mobile/android/build.gradle` — Kotlin, Firebase plugins, Mapbox repo
- [x] `mobile/android/gradle.properties`
- [x] `mobile/android/app/build.gradle` — minSdk 26, targetSdk 36, flavors dev/staging/prod
- [x] `mobile/android/app/src/main/AndroidManifest.xml` — toutes les permissions

### CI/CD
- [x] `.github/workflows/ci.yml` — lint + test (Functions + Flutter) sur push/PR
- [x] `.github/workflows/deploy_functions.yml` — déploiement Firebase
- [x] `.github/workflows/android_build.yml` — build AAB + Google Play
- [x] `.github/workflows/ios_build.yml` — build IPA + TestFlight (macOS runner)

---

## 🔄 En cours / À faire

### Mobile — Couche données
- [ ] Modèles Freezed : `UserModel`, `RideModel`, `ScheduledRideModel`, `MessageModel`
- [ ] Repositories : `RideRepository`, `UserRepository`, `PaymentRepository`
- [ ] Providers Riverpod pour chaque feature
- [ ] `FlutterFire configure` → remplir `firebase_options.dart` (voyaj-dev/staging/prod)

### Mobile — Écrans (remplacer les placeholders)
- [ ] **Auth** : splash → onboarding → choix auth → email/téléphone → OTP → CGU
- [ ] **Profil** : setup → profil → vérification identité → véhicule
- [ ] **Chauffeur** : home (carte Mapbox, toggle en ligne, estimation gains)
- [ ] **Passager** : home (recherche adresse, demande de course, carte)
- [ ] **Tracking course** : carte temps réel, code 4 chiffres, timer, actions
- [ ] **Covoiturage programmé** : publication → recherche → réservation
- [ ] **Messagerie** : liste → conversation (bulles, photos)
- [ ] **Événements** : liste → détail → inscription
- [ ] **Points & récompenses** : solde → catalogue → échange
- [ ] **Je suis bien rentré** : activation → suivi → arrivée
- [ ] **Paiement** : méthodes → ajout → historique
- [ ] **Paramètres** : notifications, suppression compte, RGPD

### Mobile — Features transversales
- [ ] Mapbox : carte + autocomplétion + itinéraire avec trafic
- [ ] Stripe SDK : formulaire carte + 3DS
- [ ] WebRTC : appels audio en course
- [ ] Biométrie : authentification secondaire paiements

### Cloud Functions — À compléter
- [ ] `bookScheduledRide.ts` — réservation + paiement immédiat
- [ ] `cancelScheduledRide.ts` — annulation + remboursement/pénalité
- [ ] `stripeWebhook.ts` — webhook Stripe (idempotent, signature vérifiée)
- [ ] `calculatePrice.ts` — callable pour l'app (estimation avant demande)
- [ ] `submitRating.ts` — notation mutuelle après course
- [ ] `createDispute.ts` — litige + notification admin
- [ ] `verifyIdentity.ts` — intégration Stripe Identity / revue manuelle
- [ ] `points/*.ts` — attribution et échange de points
- [ ] `notifications/onRideUpdate.ts` — trigger Firestore → notif
- [ ] Cloud Tasks : timeout 90 s acceptation, timeout 5 min attente

### Firebase
- [ ] Créer les 3 projets Firebase (dev/staging/prod)
- [ ] `firebase/.firebaserc` → alias dev/staging/prod
- [ ] Configurer App Check (Play Integrity + App Attest)
- [ ] Configurer Remote Config (flags feature, prix carburant)
- [ ] Stripe secret key → Firebase Secret Manager
- [ ] Mapbox token → Firebase Secret Manager

### Web
- [ ] `web/jsbr/index.html` — page publique "Je suis bien rentré" (Leaflet + OSM)
- [ ] `web/legal/` — CGU, politique confidentialité, mentions légales

### Admin
- [ ] `admin/` — panneau admin React/Next.js (vérifications KYC, litiges, config)

### Dépenses & démarches
- [ ] Structure juridique + compte Stripe (KYC)
- [ ] Apple Developer → bundle ID définitif (remplacer com.voyaj.app)
- [ ] Google Play Developer Console
- [ ] Avocat : CGU, requalification transport, points, portefeuille

---

## 🔑 Secrets à configurer (GitHub Actions)

| Secret | Description |
|--------|-------------|
| `FIREBASE_TOKEN` | `firebase login:ci` |
| `STRIPE_SECRET_KEY` | Stripe secret key (prod) |
| `ANDROID_KEYSTORE_BASE64` | Keystore Android en base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Mot de passe keystore |
| `ANDROID_KEY_ALIAS` | Alias de la clé |
| `ANDROID_KEY_PASSWORD` | Mot de passe de la clé |
| `GOOGLE_SERVICES_JSON_PROD` | google-services.json prod |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Compte service Google Play |
| `IOS_P12_BASE64` | Certificat iOS en base64 |
| `IOS_P12_PASSWORD` | Mot de passe du certificat |
| `IOS_PROVISIONING_PROFILE_BASE64` | Profil de provisioning |
| `GOOGLE_SERVICE_INFO_PLIST_PROD_BASE64` | GoogleService-Info.plist prod |
| `APPSTORE_ISSUER_ID` | App Store Connect issuer ID |
| `APPSTORE_API_KEY_ID` | App Store Connect key ID |
| `APPSTORE_API_PRIVATE_KEY` | Clé privée App Store Connect |
