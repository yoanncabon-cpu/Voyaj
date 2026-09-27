# Voyaj — Points à vérifier avec un professionnel

Ces points sont implémentés derrière des **flags Remote Config** désactivés par défaut.
Ils ne doivent pas être activés en production sans aval d'un avocat ou d'un expert compétent.

---

## 🔴 JURIDIQUE — Avocat obligatoire avant ouverture au public

### 1. Requalification en transport à titre onéreux (risque critique)
**Question :** Le modèle de la « course immédiate » (chauffeur en ligne qui reçoit des demandes, 90 s pour accepter, se déplace vers le passager) est-il défendable comme covoiturage au sens de L3132-1 du Code des transports, ou risque-t-il d'être requalifié en VTC/TPAP ?
**Garde-fous produit en place :** destination du conducteur obligatoire et compatible, détour maximal, prix = partage de frais réels, pas de professionnels, pas de paiement du déplacement à vide (voir point 2).
**Flag Remote Config :** `feature_instant_ride_enabled` (désactivé par défaut en prod)
**Référence :** CJUE C-320/16 Uber France 2018, Cass. crim. 2016, art. L3132-1 et L3120-1 Code des transports.

### 2. Paiement du chauffeur quand le passager est absent
**Question :** Le fait qu'une course immédiate annulée (passager absent) soit quand même payée au chauffeur est-il légalement compatible avec le cadre du partage de frais ? Ne constitue-t-il pas une rémunération du déplacement ?
**Flag Remote Config :** `feature_pay_driver_on_no_show` (désactivé par défaut)

### 3. Portefeuille Voyaj et codes de recharge
**Question :** Le portefeuille (solde max 500 €, recharges par carte, par lien de paiement tiers, par codes vendus en bureau de tabac) relève-t-il de la monnaie électronique (CMF L315-1) ou des services de paiement ? L'exemption « réseau limité » est-elle applicable ? Un agrément ACPR est-il nécessaire, ou suffit-il d'un partenaire EME agréé (Mangopay, Lemonway, Swan…) ?
**Flag Remote Config :** `feature_wallet_enabled` (désactivé par défaut)

### 4. Programme de points et bons d'achat
**Question :** Le programme de points (non convertibles en euros, échangeables contre des bons d'achat d'un catalogue géré par Voyaj) constitue-t-il un programme de fidélité légal ou une loterie ? Quelle fiscalité éventuelle pour les bénéficiaires ?
**Flag Remote Config :** `feature_points_enabled` (désactivé par défaut)

### 5. Pénalité de 5 € prélevée au chauffeur
**Question :** La pénalité de 5 € prélevée en cas d'annulation moins de 2 h avant le départ est-elle une clause pénale valide ? Est-elle susceptible d'être qualifiée de clause abusive (C. conso L212-1) ?
**Note :** Implémentée mais montant configurable via Remote Config `driver_late_cancel_penalty_eur`.

---

## 🟡 RÉGLEMENTAIRE — À valider avant lancement

### 6. Obligations DAC7 / article 242 bis CGI
**Question :** Voyaj, en tant que plateforme de mise en relation, est-elle soumise au reporting DAC7 (directive 2021/514) pour les revenus des chauffeurs ? Seuils, exemptions, calendrier, format de déclaration.

### 7. Registre de preuve de covoiturage (RPC / LOM)
**Question :** Conditions d'inscription de Voyaj au RPC, classes de preuve (A/B/C), subventions des Autorités Organisatrices de Mobilité (AOM), prime covoiturage / CEE en 2026. Opportunité de financement à évaluer.

### 8. Assurance des chauffeurs
**Question :** La RC auto standard couvre-t-elle les passagers en covoiturage sur une plateforme ? Quelle obligation pour Voyaj de vérifier les attestations d'assurance ? Particularités des deux-roues.

---

## 🟡 TECHNIQUE — À confirmer avant mise en production

### 9. Bundle ID / Identifiant de lot
**Statut :** placeholder `com.voyaj.app` utilisé partout.
**Action :** confirmer l'identifiant exact (doit correspondre à App Store Connect), puis mettre à jour `mobile/android/app/build.gradle`, `mobile/ios/Runner.xcodeproj/project.pbxproj`, Firebase, Stripe, liens universels.

### 10. Région Firebase
**Statut :** `europe-west1` (Belgique) utilisé par défaut.
**Alternative :** `europe-west9` (Paris) pour une meilleure latence, à comparer sur les coûts.

### 11. Fournisseur de vérification d'identité
**Question :** Stripe Identity, Ubble, Onfido, Veriff ? Disponibilité France, SDK Flutter, prix par vérification, liveness, permis/carte grise. À choisir avant l'étape 2 de construction.

### 12. Notifications plein écran (course immédiate) — Android 14+
**Question :** `USE_FULL_SCREEN_INTENT` est restreint depuis Android 14 aux apps d'appel/alarme. Quelle stratégie pour afficher la demande de course en plein écran depuis le service de premier plan ? Tester sur Android 14 et 15 avant le lancement.

### 13. Appels entrants en plein écran — iOS
**Question :** Sur iOS, les appels VoIP (WebRTC) doivent utiliser PushKit + CallKit pour s'afficher en plein écran même app fermée. La review App Store exige que CallKit soit utilisé de manière authentique pour des appels réels. À valider.

---

## 🟢 RGPD / CNIL

### 14. AIPD (Analyse d'Impact sur la Protection des Données)
**Obligatoire pour :** géolocalisation temps réel des conducteurs, traitement des pièces d'identité (catégorie sensible), page de suivi « Je suis bien rentré » (position publique via lien court).

### 15. Durées de conservation
**À définir :** courses (combien de temps ?), messages, positions GPS, documents KYC, logs de paiement, données de profil après suppression de compte.

### 16. Transferts hors UE
**Concernés :** Firebase/Google Cloud (Data Privacy Framework ✓), Stripe (DPA ✓), Mapbox (à vérifier). Mentions à inclure dans la politique de confidentialité.
