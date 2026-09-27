import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_provider.g.dart';

/// Stream de l'état d'authentification Firebase.
/// Null = non connecté.
@riverpod
Stream<User?> authState(AuthStateRef ref) {
  return FirebaseAuth.instance.authStateChanges();
}

/// UID de l'utilisateur courant (lance si non connecté).
@riverpod
String currentUid(CurrentUidRef ref) {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) throw Exception('Non authentifié');
  return user.uid;
}

@riverpod
ThemeMode themeMode(ThemeModeRef ref) => ThemeMode.system;
