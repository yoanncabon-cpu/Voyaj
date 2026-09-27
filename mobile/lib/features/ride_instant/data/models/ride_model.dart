import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'ride_model.freezed.dart';
part 'ride_model.g.dart';

/// Statuts possibles d'une course immédiate
enum RideStatus {
  searching,
  accepted,
  pickup,
  in_progress,
  ended,
  confirmed,
  cancelled,
  passenger_absent,
}

@freezed
class PriceBreakdown with _$PriceBreakdown {
  const factory PriceBreakdown({
    required double distanceKm,
    required double fuelCostEur,
    required double wearCostEur,
    required double totalCostEur,
    required double passengerShareEur,
    required double voyajFeeEur,
    required double passengerTotalEur,
    required double driverEarningsEur,
  }) = _PriceBreakdown;

  factory PriceBreakdown.fromJson(Map<String, dynamic> json) =>
      _$PriceBreakdownFromJson(json);
}

@freezed
class RideModel with _$RideModel {
  const factory RideModel({
    required String rideId,
    required String passengerId,
    required String passengerName,
    String? passengerPhotoUrl,
    required double passengerRating,

    required double pickupLat,
    required double pickupLng,
    required String pickupAddress,
    required double destinationLat,
    required double destinationLng,
    required String destinationAddress,
    required double distanceKm,

    required PriceBreakdown priceBreakdown,
    required RideStatus status,

    // Remplis à l'acceptation
    String? driverId,
    String? driverName,
    String? driverPhotoUrl,
    double? driverRating,
    double? driverLat,
    double? driverLng,
    String? vehicleDescription,
    String? licensePlate,
    String? vehicleColor,
    String? pickupCode,
    String? stripePaymentIntentId,

    required DateTime createdAt,
    DateTime? acceptedAt,
    DateTime? arrivedAt,
    DateTime? startedAt,
    DateTime? endedAt,
    DateTime? confirmedAt,
    DateTime? cancelledAt,
    String? cancelledBy,
    bool? autoConfirmed,
  }) = _RideModel;

  factory RideModel.fromJson(Map<String, dynamic> json) =>
      _$RideModelFromJson(json);

  factory RideModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data()!;
    return RideModel.fromJson({
      ...data,
      'rideId': doc.id,
      'status': (data['status'] as String?) ?? 'searching',
      'createdAt': (data['createdAt'] as Timestamp?)?.toDate().toIso8601String()
          ?? DateTime.now().toIso8601String(),
      'acceptedAt': (data['acceptedAt'] as Timestamp?)?.toDate().toIso8601String(),
      'arrivedAt': (data['arrivedAt'] as Timestamp?)?.toDate().toIso8601String(),
      'startedAt': (data['startedAt'] as Timestamp?)?.toDate().toIso8601String(),
      'endedAt': (data['endedAt'] as Timestamp?)?.toDate().toIso8601String(),
      'confirmedAt': (data['confirmedAt'] as Timestamp?)?.toDate().toIso8601String(),
      'cancelledAt': (data['cancelledAt'] as Timestamp?)?.toDate().toIso8601String(),
    });
  }
}
