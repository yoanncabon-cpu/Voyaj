/**
 * Voyaj Cloud Functions — Point d'entrée
 * Région par défaut : europe-west1
 * Runtime : Node 22, 2nd gen
 *
 * Organisation :
 *   auth/        → gestion des utilisateurs / custom claims
 *   rides/       → instant/ et scheduled/
 *   messaging/   → chat
 *   safe_return/ → "Je suis bien rentré"
 *   payment/     → webhooks Stripe
 *   admin/       → fonctions d'administration
 */

// ── Auth ──────────────────────────────────────────────────────────────────────
export { onUserProfileCreated, setUserClaims } from './auth/onUserCreated';

// ── Course immédiate ──────────────────────────────────────────────────────────
export { requestRide } from './rides/instant/requestRide';
export { acceptRide } from './rides/instant/acceptRide';
export { updateRideStatus } from './rides/instant/updateRideStatus';
export { updateDriverLocation } from './rides/instant/updateDriverLocation';
export { autoConfirmRides } from './rides/instant/autoConfirmRide';

// ── Course immédiate — notation ───────────────────────────────────────────────
export { submitRating } from './rides/instant/submitRating';

// ── Calcul de prix ────────────────────────────────────────────────────────────
export { calculateRidePrice } from './rides/calculatePrice';

// ── Covoiturage programmé ─────────────────────────────────────────────────────
export { publishScheduledRide } from './rides/scheduled/publishScheduledRide';
export { bookScheduledRide } from './rides/scheduled/bookScheduledRide';
export { cancelScheduledRide } from './rides/scheduled/cancelScheduledRide';

// ── Messagerie ────────────────────────────────────────────────────────────────
export { sendMessage } from './messaging/sendMessage';

// ── Je suis bien rentré ───────────────────────────────────────────────────────
export { startSafeReturn, updateSafeReturn, expireSafeReturns } from './safe_return/safeReturn';

// ── Litiges ───────────────────────────────────────────────────────────────────
export { createDispute } from './disputes/createDispute';

// ── Vérification d'identité ───────────────────────────────────────────────────
export { setVerificationPending } from './users/setVerificationPending';

// ── Profil / véhicule / compte ───────────────────────────────────────────────
export { saveVehicle } from './users/saveVehicle';
export { deleteAccount } from './users/deleteAccount';

// ── Points ────────────────────────────────────────────────────────────────────
export { redeemPoints } from './points/redeemPoints';

// ── Paiement — webhook Stripe ─────────────────────────────────────────────────
export { stripeWebhook } from './payment/stripeWebhook';

// ── Notifications Firestore triggers ─────────────────────────────────────────
export { onRideStatusUpdated, onScheduledBookingUpdated } from './notifications/onRideUpdate';
