import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../features/auth/presentation/screens/splash_screen.dart';
import '../../features/auth/presentation/screens/onboarding_screen.dart';
import '../../features/auth/presentation/screens/auth_choice_screen.dart';
import '../../features/auth/presentation/screens/auth_email_screen.dart';
import '../../features/auth/presentation/screens/auth_phone_screen.dart';
import '../../features/auth/presentation/screens/auth_otp_screen.dart';
import '../../features/auth/presentation/screens/terms_screen.dart';
import '../../features/profile/presentation/screens/profile_setup_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/profile/presentation/screens/public_profile_screen.dart';
import '../../features/profile/presentation/screens/verification_screen.dart';
import '../../features/profile/presentation/screens/vehicle_screen.dart';
import '../../features/ride_instant/presentation/screens/driver_home_screen.dart';
import '../../features/ride_instant/presentation/screens/passenger_home_screen.dart';
import '../../features/ride_instant/presentation/screens/ride_request_screen.dart';
import '../../features/ride_instant/presentation/screens/instant_ride_tracking_screen.dart';
import '../../features/ride_instant/presentation/screens/driver_navigation_screen.dart';
import '../../features/ride_instant/presentation/screens/ride_summary_screen.dart';
import '../../features/ride_scheduled/presentation/screens/publish_ride_screen.dart';
import '../../features/ride_scheduled/presentation/screens/search_rides_screen.dart';
import '../../features/ride_scheduled/presentation/screens/book_ride_screen.dart';
import '../../features/ride_scheduled/presentation/screens/post_request_screen.dart';
import '../../features/messaging/presentation/screens/messages_screen.dart';
import '../../features/messaging/presentation/screens/conversation_screen.dart';
import '../../features/events/presentation/screens/events_screen.dart';
import '../../features/events/presentation/screens/event_detail_screen.dart';
import '../../features/points/presentation/screens/points_screen.dart';
import '../../features/points/presentation/screens/rewards_screen.dart';
import '../../features/safe_return/presentation/screens/safe_return_screen.dart';
import '../../features/payment/presentation/screens/payment_screen.dart';
import '../../features/payment/presentation/screens/wallet_screen.dart';
import '../../features/history/presentation/screens/history_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../screens/home_scaffold.dart';
import '../screens/dispute_screen.dart';
import '../providers/auth_provider.dart';
import '../constants/app_constants.dart';

part 'app_router.g.dart';

@riverpod
GoRouter appRouter(AppRouterRef ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: AppConstants.routeSplash,
    debugLogDiagnostics: true,
    redirect: (context, state) {
      final isAuthenticated = authState.valueOrNull != null;
      final isAuthRoute = state.matchedLocation.startsWith('/auth') ||
          state.matchedLocation == AppConstants.routeSplash ||
          state.matchedLocation == AppConstants.routeOnboarding ||
          state.matchedLocation == AppConstants.routeTerms ||
          state.matchedLocation == AppConstants.routeProfileSetup;

      if (!isAuthenticated && !isAuthRoute) {
        return AppConstants.routeAuthChoice;
      }
      return null;
    },
    routes: [
      // ---- Bootstrap ----
      GoRoute(
        path: AppConstants.routeSplash,
        builder: (_, __) => const SplashScreen(),
      ),
      GoRoute(
        path: AppConstants.routeOnboarding,
        builder: (_, __) => const OnboardingScreen(),
      ),

      // ---- Auth ----
      GoRoute(
        path: AppConstants.routeAuthChoice,
        builder: (_, __) => const AuthChoiceScreen(),
      ),
      GoRoute(
        path: AppConstants.routeAuthEmail,
        builder: (_, __) => const AuthEmailScreen(),
      ),
      GoRoute(
        path: AppConstants.routeAuthPhone,
        builder: (_, __) => const AuthPhoneScreen(),
      ),
      GoRoute(
        path: AppConstants.routeAuthVerifyOtp,
        builder: (context, state) => AuthOtpScreen(
          extra: state.extra as Map<String, dynamic>? ?? {},
        ),
      ),
      GoRoute(
        path: AppConstants.routeTerms,
        builder: (_, __) => const TermsScreen(),
      ),
      GoRoute(
        path: AppConstants.routeProfileSetup,
        builder: (_, __) => const ProfileSetupScreen(),
      ),

      // ---- Shell principal (barre de navigation) ----
      ShellRoute(
        builder: (context, state, child) => HomeScaffold(child: child),
        routes: [
          GoRoute(
            path: AppConstants.routeDriverHome,
            builder: (_, __) => const DriverHomeScreen(),
          ),
          GoRoute(
            path: AppConstants.routePassengerHome,
            builder: (_, __) => const PassengerHomeScreen(),
          ),
          GoRoute(
            path: AppConstants.routeMessages,
            builder: (_, __) => const MessagesScreen(),
          ),
          GoRoute(
            path: AppConstants.routeEvents,
            builder: (_, __) => const EventsScreen(),
          ),
          GoRoute(
            path: AppConstants.routeProfile,
            builder: (_, __) => const ProfileScreen(),
          ),
        ],
      ),

      // ---- Course immédiate ----
      GoRoute(
        path: AppConstants.routeInstantRide,
        builder: (_, __) => const InstantRideTrackingScreen(rideId: null),
      ),
      GoRoute(
        path: AppConstants.routeInstantRideTracking,
        builder: (context, state) => InstantRideTrackingScreen(
          rideId: state.pathParameters['rideId'],
        ),
      ),
      GoRoute(
        path: AppConstants.routeDriverRideRequest,
        builder: (context, state) => RideRequestScreen(
          rideId: state.pathParameters['rideId']!,
        ),
      ),
      GoRoute(
        path: AppConstants.routeDriverNavigation,
        builder: (context, state) => DriverNavigationScreen(
          rideId: state.pathParameters['rideId']!,
        ),
      ),
      GoRoute(
        path: AppConstants.routeDriverRideSummary,
        builder: (context, state) => RideSummaryScreen(
          rideId: state.pathParameters['rideId']!,
        ),
      ),

      // ---- Covoiturage programmé ----
      GoRoute(
        path: AppConstants.routePublishRide,
        builder: (_, __) => const PublishRideScreen(),
      ),
      GoRoute(
        path: AppConstants.routeSearchRides,
        builder: (_, __) => const SearchRidesScreen(),
      ),
      GoRoute(
        path: AppConstants.routeBookRide,
        builder: (context, state) => BookRideScreen(
          rideId: state.pathParameters['rideId']!,
        ),
      ),
      GoRoute(
        path: AppConstants.routePostRideRequest,
        builder: (_, __) => const PostRequestScreen(),
      ),

      // ---- Messagerie & appels ----
      GoRoute(
        path: AppConstants.routeConversation,
        builder: (context, state) => ConversationScreen(
          userId: state.pathParameters['userId']!,
        ),
      ),

      // ---- Événements ----
      GoRoute(
        path: AppConstants.routeEventDetail,
        builder: (context, state) => EventDetailScreen(
          eventId: state.pathParameters['eventId']!,
        ),
      ),

      // ---- Points & récompenses ----
      GoRoute(
        path: AppConstants.routePoints,
        builder: (_, __) => const PointsScreen(),
      ),
      GoRoute(
        path: AppConstants.routeRewards,
        builder: (_, __) => const RewardsScreen(),
      ),

      // ---- Sécurité ----
      GoRoute(
        path: AppConstants.routeSafeReturn,
        builder: (_, __) => const SafeReturnScreen(),
      ),

      // ---- Profil & settings ----
      GoRoute(
        path: AppConstants.routeProfilePublic,
        builder: (context, state) => PublicProfileScreen(
          userId: state.pathParameters['userId']!,
        ),
      ),
      GoRoute(
        path: AppConstants.routeVerification,
        builder: (_, __) => const VerificationScreen(),
      ),
      GoRoute(
        path: AppConstants.routeVehicle,
        builder: (_, __) => const VehicleScreen(),
      ),

      // ---- Paiement ----
      GoRoute(
        path: AppConstants.routePayment,
        builder: (_, __) => const PaymentScreen(),
      ),
      GoRoute(
        path: AppConstants.routeWallet,
        builder: (_, __) => const WalletScreen(),
      ),

      // ---- Historique ----
      GoRoute(
        path: AppConstants.routeHistory,
        builder: (_, __) => const HistoryScreen(),
      ),

      // ---- Settings ----
      GoRoute(
        path: AppConstants.routeSettings,
        builder: (_, __) => const SettingsScreen(),
      ),

      // ---- Litige ----
      GoRoute(
        path: AppConstants.routeDispute,
        builder: (context, state) => DisputeScreen(
          rideId: state.pathParameters['rideId']!,
        ),
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      body: Center(
        child: Text('Page non trouvée : ${state.error}'),
      ),
    ),
  );
}
