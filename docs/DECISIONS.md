# Voyaj — Journal des décisions d'architecture

Format : `[DATE] DÉCISION — Raison — Alternatives rejetées`

---

## Fondations

**[2026-09-27] Bundle ID placeholder : `com.voyaj.app`**
— Aucun bundle ID définitif fourni. Le placeholder est utilisé partout. À remplacer dans `mobile/android/app/build.gradle`, `mobile/ios/Runner.xcodeproj/project.pbxproj`, Firebase, Stripe et les liens universels avant la première soumission aux stores.

**[2026-09-27] Android API 36, minSdk 26**
— Le SDK Android existant sur la machine est android-36. MinSdk 26 (Android 8.0, 2017) couvre ~98 % des appareils actifs en France.
— Rejeté : minSdk 21 (trop vieux, certains packages l'exigent à 23+).

**[2026-09-27] Region Firebase : europe-west1 (Belgique)**
— Meilleure couverture multi-services (Firestore, Functions, Storage dans la même région), disponible depuis longtemps, coûts stables.
— Alternative non choisie : europe-west9 (Paris) — plus récente, à évaluer si la latence devient un problème.

**[2026-09-27] Stripe Connect avec comptes Express**
— Les chauffeurs sont des particuliers. Le type Express permet un onboarding rapide, Stripe gère le KYC, les virements SEPA et la conformité. Voyaj prélève les frais et transfère le solde.
— Rejeté : Stripe Custom (trop complexe pour un solo), Stripe Standard (perd le contrôle des frais).

**[2026-09-27] Pas de portefeuille dans la version initiale**
— Le portefeuille (rechargeable par codes en bureau de tabac, par lien de paiement tiers) touche potentiellement à la réglementation sur la monnaie électronique (ACPR). Implémenté derrière `feature_wallet_enabled=false`. Activé après avis d'avocat.

**[2026-09-27] Positions en temps réel : Firestore + geohash**
— Firestore geohash (via geoflutterfire_plus) pour la recherche des conducteurs proches. Si le coût des écritures devient trop élevé (> 1 000 conducteurs actifs simultanément), migration partielle vers Realtime Database pour les mises à jour de position.

**[2026-09-27] Timers serveur : Cloud Tasks (pas de cron client)**
— Les 90 s d'acceptation, 5 min d'attente, +2 min décision auto, 24 h confirmation d'office sont tous gérés par Cloud Tasks côté serveur. Le client ne peut pas les annuler.

**[2026-09-27] Architecture mobile : feature-first + Riverpod**
— Chaque fonctionnalité est autonome dans `lib/features/<feature>/`. Riverpod pour l'état (code generation via @riverpod), go_router pour la navigation, freezed pour les modèles immuables.
— Rejeté : BLoC (trop verbeux pour un solo), Provider (déprécié pour de nouveaux projets), GetX (anti-pattern).

**[2026-09-27] Vérification d'identité : à choisir**
— Voir docs/A_VERIFIER.md point 11. Placeholder en place dans le code, à connecter à Stripe Identity ou Ubble.

**[2026-09-27] Notifications haute priorité Android : FCM data message + flutter_local_notifications**
— Pour afficher la demande de course avec son/vibration et une action immédiate, même en arrière-plan : FCM data message (pas notification) → `onBackgroundMessage` → affichage via flutter_local_notifications avec fullScreenIntent. Sur Android 14+ : `USE_FULL_SCREEN_INTENT` restreint aux apps d'appel/alarme — voir A_VERIFIER.md point 12.

**[2026-09-27] Page « Je suis bien rentré » : page web statique sur Firebase Hosting**
— Accessible sans compte, carte OSM via Leaflet.js, position mise à jour en temps réel via Firestore (lecture publique limitée au document du suivi).
