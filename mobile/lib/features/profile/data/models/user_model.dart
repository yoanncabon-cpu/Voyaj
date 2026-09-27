import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'user_model.freezed.dart';
part 'user_model.g.dart';

enum VerificationStatus { none, pending, approved, rejected }

@freezed
class UserModel with _$UserModel {
  const factory UserModel({
    required String uid,
    required String firstName,
    String? lastName,
    String? photoUrl,
    String? phone,
    String? email,

    // Profil
    @Default(5.0) double rating,
    @Default(0) int ratingCount,
    @Default(0) int completedRides,
    @Default(0) int cancelledRides,

    // Statuts
    @Default(false) bool isDriver,
    @Default(false) bool isOnline,
    @Default(false) bool isVerified,
    @Default(VerificationStatus.none) VerificationStatus verificationStatus,
    @Default(false) bool isSuspended,
    @Default(0) int warningCount,

    // Stripe
    String? stripeCustomerId,
    String? stripeAccountId, // Connect Express (chauffeurs)

    // FCM
    String? fcmToken,

    // Points (cache local, source de vérité = /points/{uid})
    @Default(0) int pointsBalance,

    // Géolocalisation (chauffeur en ligne)
    double? lastLat,
    double? lastLng,

    required DateTime createdAt,
    DateTime? updatedAt,
  }) = _UserModel;

  factory UserModel.fromJson(Map<String, dynamic> json) =>
      _$UserModelFromJson(json);

  factory UserModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data()!;
    return UserModel.fromJson({
      ...data,
      'uid': doc.id,
      'verificationStatus':
          (data['verificationStatus'] as String?) ?? 'none',
      'createdAt': (data['createdAt'] as Timestamp?)?.toDate().toIso8601String()
          ?? DateTime.now().toIso8601String(),
      'updatedAt': (data['updatedAt'] as Timestamp?)?.toDate().toIso8601String(),
    });
  }
}
