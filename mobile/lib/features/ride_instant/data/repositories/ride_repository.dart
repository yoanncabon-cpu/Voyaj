import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../models/ride_model.dart';

part 'ride_repository.g.dart';

class RideRepository {
  RideRepository({
    required FirebaseFirestore firestore,
    required FirebaseFunctions functions,
  })  : _firestore = firestore,
        _functions = functions;

  final FirebaseFirestore _firestore;
  final FirebaseFunctions _functions;

  // ─── Callable Functions ─────────────────────────────────────────────────────

  /// Envoie une demande de course immédiate.
  Future<Map<String, dynamic>> requestRide({
    required double pickupLat,
    required double pickupLng,
    required String pickupAddress,
    required double destinationLat,
    required double destinationLng,
    required String destinationAddress,
    required double distanceKm,
    required String paymentMethodId,
  }) async {
    final result = await _functions.httpsCallable('requestRide').call({
      'pickupLat': pickupLat,
      'pickupLng': pickupLng,
      'pickupAddress': pickupAddress,
      'destinationLat': destinationLat,
      'destinationLng': destinationLng,
      'destinationAddress': destinationAddress,
      'distanceKm': distanceKm,
      'paymentMethodId': paymentMethodId,
    });
    return Map<String, dynamic>.from(result.data as Map);
  }

  /// Accepte une demande de course (chauffeur).
  Future<Map<String, dynamic>> acceptRide(String rideId) async {
    final result = await _functions.httpsCallable('acceptRide').call({
      'rideId': rideId,
    });
    return Map<String, dynamic>.from(result.data as Map);
  }

  /// Met à jour le statut d'une course.
  Future<void> updateRideStatus({
    required String rideId,
    required String action,
    String? pickupCode,
    double? lat,
    double? lng,
  }) async {
    await _functions.httpsCallable('updateRideStatus').call({
      'rideId': rideId,
      'action': action,
      if (pickupCode != null) 'pickupCode': pickupCode,
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
    });
  }

  /// Met à jour la position GPS du chauffeur.
  Future<void> updateDriverLocation({
    required double lat,
    required double lng,
    required String geohash,
    double? heading,
    double? speedKmh,
    required bool isOnline,
  }) async {
    await _functions.httpsCallable('updateDriverLocation').call({
      'lat': lat,
      'lng': lng,
      'geohash': geohash,
      if (heading != null) 'heading': heading,
      if (speedKmh != null) 'speedKmh': speedKmh,
      'isOnline': isOnline,
    });
  }

  // ─── Streams Firestore ──────────────────────────────────────────────────────

  /// Écoute une course en temps réel.
  Stream<RideModel?> watchRide(String rideId) {
    return _firestore
        .collection('rides')
        .doc(rideId)
        .withConverter<RideModel>(
          fromFirestore: (snap, _) => RideModel.fromFirestore(snap),
          toFirestore: (model, _) => {},
        )
        .snapshots()
        .map((snap) => snap.data());
  }

  /// Écoute les courses actives d'un utilisateur (passager).
  Stream<List<RideModel>> watchPassengerActiveRides(String uid) {
    return _firestore
        .collection('rides')
        .where('passengerId', isEqualTo: uid)
        .where('status', whereIn: ['searching', 'accepted', 'pickup', 'in_progress', 'ended'])
        .orderBy('createdAt', descending: true)
        .limit(10)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => RideModel.fromFirestore(d)).toList());
  }

  /// Écoute les courses actives d'un chauffeur.
  Stream<RideModel?> watchDriverActiveRide(String driverUid) {
    return _firestore
        .collection('rides')
        .where('driverId', isEqualTo: driverUid)
        .where('status', whereIn: ['accepted', 'pickup', 'in_progress'])
        .limit(1)
        .snapshots()
        .map((snap) => snap.docs.isEmpty
            ? null
            : RideModel.fromFirestore(snap.docs.first));
  }

  /// Écoute les demandes de course en attente (chauffeur voit toutes les 'searching').
  Stream<List<RideModel>> watchPendingRideRequests() {
    return _firestore
        .collection('rides')
        .where('status', isEqualTo: 'searching')
        .orderBy('createdAt', descending: true)
        .limit(5)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => RideModel.fromFirestore(d)).toList());
  }

  /// Récupère l'historique des courses.
  Future<List<RideModel>> fetchRideHistory(String uid) async {
    final snap = await _firestore
        .collection('rides')
        .where('passengerId', isEqualTo: uid)
        .where('status', isEqualTo: 'confirmed')
        .orderBy('confirmedAt', descending: true)
        .limit(50)
        .get();
    return snap.docs.map((d) => RideModel.fromFirestore(d)).toList();
  }
}

@riverpod
RideRepository rideRepository(RideRepositoryRef ref) {
  return RideRepository(
    firestore: FirebaseFirestore.instance,
    functions: FirebaseFunctions.instanceFor(region: 'europe-west1'),
  );
}

/// Historique des courses de l'utilisateur courant.
@riverpod
Future<List<RideModel>> rideHistory(RideHistoryRef ref) async {
  final auth = FirebaseAuth.instance;
  final uid = auth.currentUser?.uid;
  if (uid == null) return [];
  return ref.watch(rideRepositoryProvider).fetchRideHistory(uid);
}
