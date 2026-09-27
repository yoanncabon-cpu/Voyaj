import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../models/user_model.dart';

part 'user_repository.g.dart';

class UserRepository {
  UserRepository({
    required FirebaseFirestore firestore,
    required FirebaseAuth auth,
  })  : _firestore = firestore,
        _auth = auth;

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  // ─── Streams ────────────────────────────────────────────────────────────────

  /// Écoute le profil de l'utilisateur courant.
  Stream<UserModel?> watchCurrentUser() {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return Stream.value(null);
    return _firestore
        .collection('users')
        .doc(uid)
        .snapshots()
        .map((snap) =>
            snap.exists ? UserModel.fromFirestore(snap) : null);
  }

  /// Écoute le profil public d'un autre utilisateur.
  Stream<UserModel?> watchUser(String uid) {
    return _firestore
        .collection('users')
        .doc(uid)
        .snapshots()
        .map((snap) =>
            snap.exists ? UserModel.fromFirestore(snap) : null);
  }

  // ─── Lectures ────────────────────────────────────────────────────────────────

  Future<UserModel?> fetchUser(String uid) async {
    final snap = await _firestore.collection('users').doc(uid).get();
    return snap.exists ? UserModel.fromFirestore(snap) : null;
  }

  // ─── Écritures (champs autorisés côté client selon les Firestore rules) ──────

  /// Crée le profil initial (uniquement à l'inscription).
  Future<void> createProfile({
    required String uid,
    required String firstName,
    String? phone,
    String? email,
  }) async {
    await _firestore.collection('users').doc(uid).set({
      'uid': uid,
      'firstName': firstName,
      if (phone != null) 'phone': phone,
      if (email != null) 'email': email,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  /// Met à jour les champs non-sensibles du profil.
  Future<void> updateProfile(Map<String, dynamic> fields) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return;
    await _firestore.collection('users').doc(uid).update({
      ...fields,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Met à jour le token FCM.
  Future<void> updateFcmToken(String token) async {
    final uid = _auth.currentUser?.uid;
    if (uid == null) return;
    await _firestore.collection('users').doc(uid).update({
      'fcmToken': token,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Met à jour la photo de profil (URL déjà uploadée dans Storage).
  Future<void> updatePhotoUrl(String photoUrl) async {
    return updateProfile({'photoUrl': photoUrl});
  }
}

@riverpod
UserRepository userRepository(UserRepositoryRef ref) {
  return UserRepository(
    firestore: FirebaseFirestore.instance,
    auth: FirebaseAuth.instance,
  );
}

/// Provider du profil courant (stream).
@riverpod
Stream<UserModel?> currentUserProfile(CurrentUserProfileRef ref) {
  return ref.watch(userRepositoryProvider).watchCurrentUser();
}

/// Provider du profil d'un utilisateur spécifique (stream).
@riverpod
Stream<UserModel?> userStream(UserStreamRef ref, String uid) {
  return ref.watch(userRepositoryProvider).watchUser(uid);
}
