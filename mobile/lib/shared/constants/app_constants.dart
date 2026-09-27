/// Constantes de l'application Voyaj.
/// Les valeurs monétaires et de durée sont aussi dans Remote Config
/// (src vérité : serveur). Ces constantes ne servent qu'à l'affichage
/// et aux validations côté client.
class AppConstants {
  AppConstants._();

  // ---- Identité ----
  static const String bundleId = 'com.voyaj.app'; // TODO: confirmer le bundle ID réel
  static const String appName = 'Voyaj';
  static const String supportEmail = 'support@voyajapp.com';
  static const String contactEmail = 'contact@voyajapp.com';
  static const String domain = 'voyajapp.com';

  // ---- Firebase ----
  static const String firebaseRegion = 'europe-west1';

  // ---- Géolocalisation ----
  /// Rayon de recherche des conducteurs en ligne (mètres)
  static const double driverSearchRadiusMeters = 10000; // 10 km
  /// Précision GPS minimale requise pour la prise en charge (mètres)
  static const double minGpsAccuracyMeters = 25;
  /// Distance en dessous de laquelle "Je suis arrivé" est déclenché côté client
  static const double autoArrivalDistanceMeters = 100;
  /// Arrondi de la position d'un passager en attente (latitude/longitude)
  static const double passengerPositionRoundingKm = 1.0;

  // ---- Course immédiate (durées affichées — source vérité : serveur) ----
  static const Duration acceptanceTimeout = Duration(seconds: 90);
  static const Duration passengerWaitTime = Duration(minutes: 5);
  static const Duration waitExtension = Duration(minutes: 5);
  static const Duration maxPassengerWaitExtension = Duration(minutes: 20);
  static const Duration maxDriverWaitExtension = Duration(minutes: 30);
  static const Duration serverAutoDecisionDelay = Duration(minutes: 2);
  static const Duration rideConfirmationAutoDelay = Duration(hours: 24);
  static const int pickupCodeLength = 4;

  // ---- Covoiturage programmé ----
  static const int scheduledRideGenerationDays = 14;
  static const Duration lateDriverCancelBeforeDeparture = Duration(hours: 2);
  static const Duration absentPassengerMinDelay = Duration(minutes: 15);
  static const int warningsBeforeAdminReview = 3;

  // ---- Prix (affichage — calcul côté serveur) ----
  static const double wearCostPerKm = 0.12;
  static const double baseFee = 1.0;
  static const double perKmFee = 0.02;
  static const double maxFee = 4.0;
  static const double driverLateCancelPenalty = 5.0;

  // ---- Portefeuille ----
  static const double walletMinRecharge = 5.0;
  static const double walletMaxRecharge = 200.0;
  static const double walletMaxBalance = 500.0;
  static const int walletCodeMaxAttemptsPerHour = 6;

  // ---- Événements ----
  static const double eventArrivalRadiusKm = 20.0;

  // ---- Anti-abus ----
  static const int maxDriversShownToPassenger = 8;

  // ---- Route names (go_router) ----
  static const String routeSplash = '/';
  static const String routeOnboarding = '/onboarding';
  static const String routeAuthChoice = '/auth';
  static const String routeAuthEmail = '/auth/email';
  static const String routeAuthPhone = '/auth/phone';
  static const String routeAuthVerifyOtp = '/auth/otp';
  static const String routeProfileSetup = '/profile/setup';
  static const String routeTerms = '/terms';
  static const String routeHome = '/home';
  static const String routeRoleSwitch = '/home/role';
  // Chauffeur
  static const String routeDriverHome = '/driver';
  static const String routeDriverOnline = '/driver/online';
  static const String routeDriverRideRequest = '/driver/request/:rideId';
  static const String routeDriverNavigation = '/driver/navigation/:rideId';
  static const String routeDriverRideSummary = '/driver/summary/:rideId';
  static const String routePublishRide = '/driver/publish';
  static const String routeVehicle = '/driver/vehicle';
  // Passager
  static const String routePassengerHome = '/passenger';
  static const String routeInstantRide = '/passenger/instant';
  static const String routeInstantRideTracking = '/passenger/instant/:rideId';
  static const String routeSearchRides = '/passenger/search';
  static const String routeBookRide = '/passenger/book/:rideId';
  static const String routePostRideRequest = '/passenger/request';
  // Commun
  static const String routeMessages = '/messages';
  static const String routeConversation = '/messages/:userId';
  static const String routeEvents = '/events';
  static const String routeEventDetail = '/events/:eventId';
  static const String routePoints = '/points';
  static const String routeRewards = '/rewards';
  static const String routeSafeReturn = '/safe-return';
  static const String routeProfile = '/profile';
  static const String routeProfilePublic = '/profile/:userId';
  static const String routeVerification = '/verification';
  static const String routePayment = '/payment';
  static const String routeWallet = '/wallet';
  static const String routeHistory = '/history';
  static const String routeSettings = '/settings';
  static const String routeDispute = '/dispute/:rideId';
}
