# Voyaj — Avancement

> Mise à jour : 27/09/2026 — passage à Expo + Supabase + EAS (même stack que l'app paroisse).
> L'ancienne version Flutter + Firebase reste dans l'historique Git (commit `5212d7d`).

## Fait et vérifié

### Backend Supabase
- [x] Schéma complet : profils, véhicules, courses immédiates, trajets programmés, réservations, messagerie,
      litiges, points/récompenses, « bien rentré », jetons push, journal d'audit, événements Stripe
- [x] RLS + droits par colonne — **testés** dans un Postgres embarqué : aucune écriture client possible sur argent/statuts
- [x] Fonctions atomiques : réservation de places (pas de survente), débit de points (pas de double dépense), note moyenne
- [x] 22 Edge Functions — `deno check` + `deno lint` OK
- [x] Moteur de prix — 8 tests OK
- [x] Déclencheur messages → push, tâche de maintenance chaque minute (pg_cron)

### App Expo (SDK 54)
- [x] Connexion / inscription / CGU obligatoires
- [x] Accueil passager + mode chauffeur (en ligne, destination obligatoire, demandes reçues)
- [x] Course immédiate : estimation → PaymentSheet (autorisation) → recherche → suivi en direct du chauffeur → code → fin → confirmation → note
- [x] Chauffeur : écran d'acceptation 90 s, conduite (arrivé / code / départ / fin / absence après 5 min), lien GPS
- [x] Trajets programmés : recherche, publication, réservation + paiement, annulation, notation, demande de trajet
- [x] Messagerie temps réel + blocage
- [x] Profil, véhicule, vérification d'identité (photos), historique, points, virements Stripe, paramètres, suppression du compte
- [x] « Je suis bien rentré » + page web publique `web/jsbr`
- [x] `tsc` OK, `expo lint` OK, `expo-doctor` 18/18, bundles iOS et Android compilés

## Reste à faire

### Pour la première build TestFlight
- [ ] Créer le projet Supabase « voyaj », appliquer les migrations, déployer les fonctions, définir les secrets
- [ ] Renseigner les clés publiques dans `app/eas.json` (Supabase URL/anon, Stripe publishable)
- [ ] `eas init` (projet EAS « voyaj » sous le compte tansi) puis `eas build -p ios` + `eas submit`
- [ ] Créer l'app dans App Store Connect et mettre son Apple ID dans `eas.json` (`ascAppId`)
- [ ] Icône et écran de démarrage Voyaj (actuellement ceux du modèle Expo)

### Avant le lancement public
- [ ] Panneau admin (validation des identités, litiges, remboursements, réglages de prix)
- [ ] Position chauffeur en arrière-plan (expo-task-manager) — aujourd'hui l'app doit rester ouverte
- [ ] Clé Google Maps Android (sinon la carte est remplacée par un encart sur Android)
- [ ] Autocomplétion d'adresses (Mapbox) — aujourd'hui géocodage du téléphone à la validation
- [ ] Trajets récurrents : le choix est enregistré mais les occurrences ne sont pas encore créées automatiquement
- [ ] Pages web `cgu` / `confidentialite` sur voyajapp.com (liens déjà présents dans l'app)
- [ ] Événements/festivals, appels, portefeuille : itérations suivantes (cf. plan)
