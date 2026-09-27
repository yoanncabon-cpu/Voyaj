// Ce fichier est généré par FlutterFire CLI.
// Lance : flutterfire configure --project=voyaj-dev
// puis : flutterfire configure --project=voyaj-prod
// et sélectionne le bon fichier selon l'environnement dans la CI.
//
// NE JAMAIS committer les clés secrètes (API key côté serveur).
// Ce fichier contient uniquement des clés publiques (client-side).

// ignore_for_file: lines_longer_than_80_chars, avoid_classes_with_only_static_members
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// [DefaultFirebaseOptions] généré par FlutterFire CLI.
/// Remplace ce fichier en exécutant : `flutterfire configure`
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        throw UnsupportedError(
          'DefaultFirebaseOptions non configuré pour macOS',
        );
      case TargetPlatform.windows:
        throw UnsupportedError(
          'DefaultFirebaseOptions non configuré pour Windows',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions non configuré pour cette plateforme',
        );
    }
  }

  // TODO : remplacer par les vraies valeurs après `flutterfire configure`
  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'PLACEHOLDER_API_KEY',
    appId: 'PLACEHOLDER_APP_ID',
    messagingSenderId: 'PLACEHOLDER_SENDER_ID',
    projectId: 'voyaj-dev',
    authDomain: 'voyaj-dev.firebaseapp.com',
    storageBucket: 'voyaj-dev.appspot.com',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'PLACEHOLDER_API_KEY',
    appId: 'PLACEHOLDER_APP_ID',
    messagingSenderId: 'PLACEHOLDER_SENDER_ID',
    projectId: 'voyaj-dev',
    storageBucket: 'voyaj-dev.appspot.com',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'PLACEHOLDER_API_KEY',
    appId: 'PLACEHOLDER_APP_ID',
    messagingSenderId: 'PLACEHOLDER_SENDER_ID',
    projectId: 'voyaj-dev',
    storageBucket: 'voyaj-dev.appspot.com',
    iosBundleId: 'com.voyaj.app',
  );
}
