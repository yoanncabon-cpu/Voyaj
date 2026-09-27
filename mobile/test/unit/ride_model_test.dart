import 'package:flutter_test/flutter_test.dart';
import 'package:voyaj/features/ride_instant/data/models/ride_model.dart';

/// Vérifie que le client lit bien les documents tels que les écrivent
/// les Cloud Functions (nombres entiers, statuts snake_case…).
void main() {
  final priceJson = <String, dynamic>{
    'distanceKm': 10,
    'fuelCostEur': 1.3,
    'wearCostEur': 1.2,
    'totalCostEur': 2.5,
    'passengerShareEur': 1.25,
    'voyajFeeEur': 4, // entier côté serveur (plafond)
    'passengerTotalEur': 5.25,
    'driverEarningsEur': 1.25,
  };

  Map<String, dynamic> rideJson(String status) => {
        'rideId': 'ride_1',
        'passengerId': 'p1',
        'passengerName': 'Alice',
        'passengerRating': 5,
        'pickupLat': 48.85,
        'pickupLng': 2.35,
        'pickupAddress': 'Paris',
        'destinationLat': 48.87,
        'destinationLng': 2.36,
        'destinationAddress': 'Gare du Nord',
        'distanceKm': 10,
        'priceBreakdown': priceJson,
        'status': status,
        'createdAt': '2026-09-27T10:00:00.000Z',
      };

  test('PriceBreakdown accepte les entiers JSON', () {
    final p = PriceBreakdown.fromJson(priceJson);
    expect(p.voyajFeeEur, 4.0);
    expect(p.distanceKm, 10.0);
    expect(p.passengerShareEur + p.voyajFeeEur, p.passengerTotalEur);
  });

  test('RideModel désérialise chaque statut serveur', () {
    for (final s in [
      'searching',
      'accepted',
      'pickup',
      'in_progress',
      'ended',
      'confirmed',
      'cancelled',
      'passenger_absent',
    ]) {
      final ride = RideModel.fromJson(rideJson(s));
      expect(ride.status.name, s);
    }
  });

  test('RideModel : champs chauffeur optionnels avant acceptation', () {
    final ride = RideModel.fromJson(rideJson('searching'));
    expect(ride.driverId, isNull);
    expect(ride.pickupCode, isNull);
    expect(ride.priceBreakdown.driverEarningsEur, 1.25);
  });
}
