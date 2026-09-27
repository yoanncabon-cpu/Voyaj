import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../data/models/ride_model.dart';
import '../../data/repositories/ride_repository.dart';

part 'ride_provider.g.dart';

/// Écoute une course spécifique par ID.
@riverpod
Stream<RideModel?> rideStream(RideStreamRef ref, String rideId) {
  return ref.watch(rideRepositoryProvider).watchRide(rideId);
}

/// Course active du passager courant.
@riverpod
Stream<List<RideModel>> passengerActiveRides(
  PassengerActiveRidesRef ref,
  String uid,
) {
  return ref.watch(rideRepositoryProvider).watchPassengerActiveRides(uid);
}

/// Course active du chauffeur courant (1 seule possible à la fois).
@riverpod
Stream<RideModel?> driverActiveRide(DriverActiveRideRef ref, String driverUid) {
  return ref.watch(rideRepositoryProvider).watchDriverActiveRide(driverUid);
}

/// Demandes en attente visibles par les chauffeurs.
@riverpod
Stream<List<RideModel>> pendingRideRequests(PendingRideRequestsRef ref) {
  return ref.watch(rideRepositoryProvider).watchPendingRideRequests();
}

/// Gère l'état de la demande de course (passager).
@riverpod
class RequestRideController extends _$RequestRideController {
  @override
  AsyncValue<String?> build() => const AsyncValue.data(null); // rideId ou null

  Future<void> request({
    required double pickupLat,
    required double pickupLng,
    required String pickupAddress,
    required double destinationLat,
    required double destinationLng,
    required String destinationAddress,
    required double distanceKm,
    required String paymentMethodId,
  }) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final result = await ref.read(rideRepositoryProvider).requestRide(
            pickupLat: pickupLat,
            pickupLng: pickupLng,
            pickupAddress: pickupAddress,
            destinationLat: destinationLat,
            destinationLng: destinationLng,
            destinationAddress: destinationAddress,
            distanceKm: distanceKm,
            paymentMethodId: paymentMethodId,
          );
      return result['rideId'] as String?;
    });
  }
}

/// Gère l'acceptation d'une course (chauffeur).
@riverpod
class AcceptRideController extends _$AcceptRideController {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<void> accept(String rideId) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(rideRepositoryProvider).acceptRide(rideId),
    );
  }
}

/// Gère les transitions de statut d'une course.
@riverpod
class RideStatusController extends _$RideStatusController {
  @override
  AsyncValue<void> build() => const AsyncValue.data(null);

  Future<void> update({
    required String rideId,
    required String action,
    String? pickupCode,
    double? lat,
    double? lng,
  }) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(
      () => ref.read(rideRepositoryProvider).updateRideStatus(
            rideId: rideId,
            action: action,
            pickupCode: pickupCode,
            lat: lat,
            lng: lng,
          ),
    );
  }
}
