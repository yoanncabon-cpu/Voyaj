# Voyaj Android (Flutter) — brancher l'app sur le backend commun

L'app iPhone (Expo) et l'app Android (Flutter) partagent **un seul backend : Supabase**.
Un passager iPhone doit pouvoir trouver un conducteur Android, et inversement : il ne faut
donc **pas** de base Firestore séparée.

Firebase ne sert qu'à **une chose : les notifications Android** (Firebase Cloud Messaging).

| Besoin | Outil |
|---|---|
| Comptes, connexion, codes e-mail | Supabase Auth (`supabase_flutter`) |
| Données (trajets, messages, profils…) | Supabase Postgres (`supabase_flutter`) |
| Temps réel | Supabase Realtime (`supabase_flutter`) |
| Photos (avatar, pièce d'identité) | Supabase Storage (`supabase_flutter`) |
| Prix, courses, paiements, annulations | Fonctions serveur Supabase (`functions.invoke`) |
| Paiement par carte | Stripe (`flutter_stripe`) |
| Notifications | Firebase Cloud Messaging (`firebase_messaging`) |

---

## 1. Connexion au projet

```yaml
# pubspec.yaml
dependencies:
  supabase_flutter: ^2.0.0
  flutter_stripe: ^11.0.0
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
  flutter_local_notifications: ^18.0.0
```

```dart
await Supabase.initialize(
  url: 'https://ugfxltshmuskegskaili.supabase.co',
  anonKey: '<clé publique « anon » : voir app/eas.json, EXPO_PUBLIC_SUPABASE_ANON_KEY>',
);
final supabase = Supabase.instance.client;
```

La clé `anon` est publique (elle est aussi dans l'app iPhone) : la sécurité repose sur les
règles d'accès (RLS) de la base. **Ne jamais mettre la clé `service_role` dans l'app.**

---

## 2. Comptes

Les comptes sont communs aux deux apps : même e-mail, même mot de passe.

### Inscription

```dart
final res = await supabase.auth.signUp(
  email: email.trim().toLowerCase(),
  password: password, // 8 caractères minimum
  data: {'name': name.trim(), 'phone': phone}, // téléphone au format +33612345678
);
// Un profil est créé automatiquement (table profiles) à partir de name et phone.
// E-mail déjà inscrit : Supabase répond « succès » sans rien envoyer,
// avec res.user!.identities vide → afficher « Un compte existe déjà ».
final dejaInscrit = res.user != null && (res.user!.identities?.isEmpty ?? false);
```

- Le numéro doit être **normalisé en `+33XXXXXXXXX`** : il est unique en base. Un doublon renvoie
  l'erreur « Database error saving new user », à afficher comme « Ce numéro est déjà associé à un compte ».
- Si `res.session == null`, l'e-mail doit être confirmé par **code à 6 chiffres** (pas de lien).

### Confirmer l'e-mail (code)

```dart
await supabase.auth.verifyOTP(email: email, token: code, type: OtpType.email);
// Renvoyer un code :
await supabase.auth.resend(type: OtpType.signup, email: email);
```

### Connexion

```dart
await supabase.auth.signInWithPassword(email: email, password: password);
```

« Email not confirmed » → renvoyer un code et ouvrir l'écran de code.

### Mot de passe oublié (code, pas de lien)

```dart
await supabase.auth.resetPasswordForEmail(email);           // envoie un code à 6 chiffres
await supabase.auth.verifyOTP(email: email, token: code, type: OtpType.recovery);
await supabase.auth.updateUser(UserAttributes(password: nouveauMotDePasse));
```

### Conditions générales

Tant que `profiles.terms_accepted_at` est vide, l'app doit afficher l'écran des CGU, puis :

```dart
await supabase.from('profiles')
  .update({'terms_accepted_at': DateTime.now().toUtc().toIso8601String()})
  .eq('id', supabase.auth.currentUser!.id);
```

---

## 3. Règle d'or : l'argent et les statuts passent par le serveur

Le téléphone **lit** les tables, mais tout ce qui touche à l'argent, aux statuts de course, aux
points ou aux vérifications passe par une **fonction serveur**. Les règles d'accès refusent
de toute façon ces écritures directes.

Écritures directes autorisées (uniquement sur ses propres lignes) :

| Table | Usage |
|---|---|
| `profiles` | nom, téléphone, `avatar_url`, `bio`, `terms_accepted_at` |
| `driver_locations` | position du conducteur en ligne (voir §6) |
| `messages` | envoyer un message, marquer comme lu |
| `push_tokens` | jeton de notification (voir §8) |
| `ride_requests` | demandes de trajet publiées par un passager |
| `user_blocks` | bloquer un utilisateur |

### Tables en lecture

| Table | Contenu |
|---|---|
| `profiles` | son propre profil (`points_balance`, `is_verified`, `verification_status`, `is_driver`…) |
| `public_profile_rows()` (fonction) | infos publiques des autres membres : nom, photo, note, trajets |
| `rides` | courses instantanées où on est passager ou conducteur |
| `ride_offers` | demandes de course proposées au conducteur |
| `ride_secrets` | code de prise en charge (passager uniquement) |
| `scheduled_rides` / `bookings` | trajets programmés et réservations |
| `vehicles` | véhicules (lecture) — écriture via `vehicle-save` |
| `conversations` / `messages` | messagerie |
| `ratings`, `points_transactions`, `rewards`, `redemptions`, `disputes`, `pricing_config` | le reste |

Fonctions SQL utiles (`supabase.rpc(...)`) :
- `get_or_create_conversation(other uuid) → uuid` : ouvrir une conversation avec quelqu'un
- `my_booking_code(booking uuid) → text` : code de prise en charge d'une réservation
- `public_profile_rows()` : profils publics

---

## 4. Fonctions serveur

```dart
final res = await supabase.functions.invoke('price-estimate', body: {
  'pickup': {'lat': 49.0242, 'lng': 2.2126, 'address': 'Taverny (95150)'},
  'dest':   {'lat': 48.9362, 'lng': 2.3574, 'address': 'Saint-Denis (93200)'},
});
final data = res.data as Map<String, dynamic>;
```

En cas d'erreur, la réponse est `{ "error": "<code>", "message": "<texte en français à afficher>" }`
avec un statut HTTP 4xx/5xx (`FunctionException` côté Flutter : lire `details['message']`).

Un lieu (`Place`) = `{ "lat": number, "lng": number, "address": string }`.

| Fonction | Entrée | Réponse |
|---|---|---|
| `price-estimate` | `pickup`, `dest`, `seats?` | `{ distanceKm, price }` |
| `ride-request` | `pickup`, `dest` | `{ rideId, price, distanceKm, paymentIntentClientSecret, ephemeralKey, customerId }` |
| `ride-confirm-payment` | `rideId` | `{ status, driversNotified? }` — à appeler **après** le paiement Stripe |
| `ride-accept` | `rideId` (conducteur) | `{ status }` |
| `ride-status` | `rideId`, `action`, `pickupCode?`, `lat?`, `lng?` | `{ status?, penaltyEur? }` |
| `ride-rate` | `rideId`, `kind` (`instant`/`scheduled`), `score` 1–5, `comment?`, `ratedUserId?` | `{}` |
| `scheduled-publish` | `origin`, `dest`, `departureAt` (ISO), `seats`, `recurringDaily` | `{ scheduledRideId, price }` |
| `scheduled-book` | `scheduledRideId`, `seats` | `{ bookingId, amountEur, paymentIntentClientSecret, ephemeralKey, customerId }` |
| `scheduled-book-confirm` | `bookingId` | `{ status, pickupCode }` |
| `scheduled-cancel` | `bookingId` **ou** `scheduledRideId` | `{ penaltyEur, refundedEur }` ou `{ refunded }` |
| `dispute-create` | `rideId`, `kind`, `reason`, `description` (10–1000 car.) | `{ disputeId }` |
| `vehicle-save` | `make`, `model`, `plate`, `color?`, `vehicleType`, `seats` | `{ plate }` |
| `verification-submit` | — (après envoi des photos, §7) | `{ status }` |
| `stripe-connect` | `returnUrl?` (doit commencer par `voyaj://`) | `{ url, onboarded, payoutsEnabled }` |
| `points-redeem` | `rewardId` | `{ code, title }` |
| `safe-return` | `action` (`start`/`update`/`arrived`/`status`), `lat?`, `lng?`, `hours?` | `{ url?, expiresAt?, active? }` |
| `account-delete` | — | `{}` |

`ride-status` — actions possibles :
- `arrive` (conducteur arrivé), `start` (avec `pickupCode` donné par le passager, et `lat`/`lng` du conducteur),
  `end` (arrivée), `confirm` (passager confirme la fin), `cancel`, `report_absent` (passager absent).

### Cycle d'une course instantanée (`rides.status`)

```
awaiting_payment → searching → accepted → pickup → in_progress → ended → confirmed
                       ↘ expired (aucun conducteur)      ↘ cancelled / passenger_absent
```

Le prix (`rides.price`, `scheduled_rides.price`) est un objet :
`{ distanceKm, fuelCostEur, wearCostEur, totalCostEur, passengerShareEur, voyajFeeEur, passengerTotalEur, driverEarningsEur }`.

---

## 5. Paiement (Stripe)

Les fonctions `ride-request` et `scheduled-book` renvoient déjà tout ce qu'il faut pour
la feuille de paiement Stripe :

```dart
Stripe.publishableKey = '<même clé publique Stripe que l'app iPhone : pk_test_… / pk_live_…>';

await Stripe.instance.initPaymentSheet(paymentSheetParameters: SetupPaymentSheetParameters(
  merchantDisplayName: 'Voyaj',
  customerId: data['customerId'],
  customerEphemeralKeySecret: data['ephemeralKey'],
  paymentIntentClientSecret: data['paymentIntentClientSecret'],
));
await Stripe.instance.presentPaymentSheet();
// Puis : ride-confirm-payment { rideId } ou scheduled-book-confirm { bookingId }
```

---

## 6. Mode conducteur et temps réel

Conducteur en ligne : envoyer sa position régulièrement (toutes les ~15 s) :

```dart
await supabase.from('driver_locations').upsert({
  'driver_id': uid, 'lat': lat, 'lng': lng, 'heading': heading,
  'is_online': true,
  'dest_lat': dest.lat, 'dest_lng': dest.lng, 'dest_address': dest.address, // destination obligatoire
  'updated_at': DateTime.now().toUtc().toIso8601String(),
});
// Passer hors ligne :
await supabase.from('driver_locations').update({'is_online': false}).eq('driver_id', uid);
```

Une position de plus de 2 minutes est considérée comme hors ligne.

Tables diffusées en temps réel : `rides`, `ride_offers`, `driver_locations`, `messages`,
`conversations`, `profiles`.

```dart
supabase.channel('ride-$rideId')
  .onPostgresChanges(
    event: PostgresChangeEvent.update, schema: 'public', table: 'rides',
    filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'id', value: rideId),
    callback: (payload) => setState(() => ride = payload.newRecord),
  )
  .subscribe();
```

Demandes reçues par un conducteur : écouter les `INSERT` sur `ride_offers` filtrés sur `driver_id`.

---

## 7. Photos

| Bucket | Chemin | Usage |
|---|---|---|
| `avatars` (public) | `{userId}/avatar-{timestamp}.jpg` | photo de profil, puis `profiles.avatar_url` = URL publique |
| `identity` (privé) | `{userId}/id_front.jpg`, `{userId}/id_back.jpg`, `{userId}/license.jpg` | vérification, puis appeler `verification-submit` |

---

## 8. Notifications (Firebase Cloud Messaging)

Le serveur envoie déjà aux deux apps : les jetons Expo (iPhone) passent par Expo, **tous les
autres jetons sont considérés comme des jetons FCM** et envoyés directement à Firebase.

### Côté Flutter

```dart
final token = await FirebaseMessaging.instance.getToken();
await supabase.from('push_tokens').upsert({
  'token': token, 'user_id': uid, 'platform': 'android',
  'updated_at': DateTime.now().toUtc().toIso8601String(),
});
FirebaseMessaging.instance.onTokenRefresh.listen((t) { /* même upsert */ });
// À la déconnexion :
await supabase.from('push_tokens').delete().eq('token', token);
```

Créer **deux canaux Android** (avec `flutter_local_notifications`) :
- `ride-requests` : importance **max**, son — demandes de course (valables 90 s)
- `default` : importance normale

Chaque notification contient `data.route`, l'écran à ouvrir au toucher :

| `data.route` | Écran |
|---|---|
| `/driver/offer/{rideId}` | nouvelle demande de course (conducteur) |
| `/ride/{rideId}` | suivi de la course (passager) |
| `/ride/summary/{rideId}` | récapitulatif d'une course terminée |
| `/scheduled/{scheduledRideId}` | trajet programmé |
| `/messages/{conversationId}` | conversation |
| `/(tabs)/trajets` | liste des trajets |
| `/` | accueil |

### Côté serveur (une seule fois)

1. Console Firebase → Paramètres du projet → **Comptes de service** → « Générer une nouvelle clé privée ».
2. Supabase → Edge Functions → **Secrets** → ajouter `FCM_SERVICE_ACCOUNT` = **tout le contenu** du fichier JSON.

Sans ce secret, les notifications Android sont simplement ignorées (l'iPhone continue de fonctionner).

---

## 9. Adresses (suggestions pendant la saisie)

L'app iPhone utilise le géocodeur gratuit de l'IGN (sans clé, toute la France) :

```
GET https://data.geopf.fr/geocodage/search?q=taverny&autocomplete=1&limit=10&index=address,poi&lat=49.02&lon=2.21
```

Résultats : `features[].geometry.coordinates = [lng, lat]`, `properties.type` =
`municipality` / `street` / `housenumber` pour les adresses, `properties._type = "poi"` pour les gares
et lieux publics. Code de référence : `app/lib/location.ts` (`searchPlaces`).

---

## 10. Pour démarrer

- [ ] Accès au dépôt GitHub `yoanncabon-cpu/Voyaj` et au projet Supabase « Voyaj »
- [ ] `supabase_flutter` branché avec l'URL et la clé `anon` (§1)
- [ ] Inscription / connexion / codes e-mail / mot de passe oublié (§2)
- [ ] Remplacer les lectures/écritures Firestore par les tables et fonctions Supabase (§3, §4)
- [ ] Projet Firebase : `google-services.json` dans l'app, jeton FCM enregistré (§8)
- [ ] Secret `FCM_SERVICE_ACCOUNT` ajouté dans Supabase (§8)
- [ ] Clé publique Stripe (§5)

Référence complète du comportement attendu : le code de l'app iPhone dans `app/`
(`app/lib/api.ts` pour les appels serveur, `app/contexts/AuthContext.tsx` pour les comptes).
