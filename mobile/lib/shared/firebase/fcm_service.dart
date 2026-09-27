import 'dart:ui' show Color;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Service de gestion des notifications FCM.
/// Gère les messages en avant-plan, en arrière-plan et quand l'app est fermée.
class FcmService {
  FcmService._();

  static final _localNotifications = FlutterLocalNotificationsPlugin();

  /// Canal haute priorité pour les demandes de course (son + vibration + plein écran).
  static const _rideRequestChannel = AndroidNotificationChannel(
    'voyaj_ride_request',
    'Demandes de course',
    description: 'Notifications pour les nouvelles demandes de course',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
    enableLights: true,
    ledColor: Color(0xFF4F46E5),
  );

  /// Canal pour les messages et notifications générales.
  static const _defaultChannel = AndroidNotificationChannel(
    'voyaj_default',
    'Notifications Voyaj',
    description: 'Notifications générales Voyaj',
    importance: Importance.high,
  );

  static Future<void> initialize() async {
    // Android : créer les canaux
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.createNotificationChannel(_rideRequestChannel);
    await androidPlugin?.createNotificationChannel(_defaultChannel);

    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: _onNotificationTapped,
      onDidReceiveBackgroundNotificationResponse: _onNotificationTappedBackground,
    );

    // Demander la permission (iOS + Android 13+)
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      criticalAlert: false,
    );

    // Messages en avant-plan
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // App ouverte depuis une notification
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationOpen);
  }

  /// Appelé par le handler top-level en arrière-plan.
  static Future<void> handleBackgroundMessage(RemoteMessage message) async {
    if (message.data['type'] == 'ride_request') {
      await _showRideRequestNotification(message);
    }
  }

  static Future<void> _handleForegroundMessage(RemoteMessage message) async {
    final type = message.data['type'] as String?;

    if (type == 'ride_request') {
      // En avant-plan : afficher le plein écran directement via navigation
      // (géré par le RideRequestProvider qui écoute Firestore)
      return;
    }

    // Autres notifications : afficher une notification locale
    final notification = message.notification;
    if (notification != null) {
      await _localNotifications.show(
        notification.hashCode,
        notification.title,
        notification.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            _defaultChannel.id,
            _defaultChannel.name,
            channelDescription: _defaultChannel.description,
            importance: Importance.high,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
          ),
          iOS: const DarwinNotificationDetails(),
        ),
        payload: message.data['route'] as String?,
      );
    }
  }

  static Future<void> _showRideRequestNotification(
    RemoteMessage message,
  ) async {
    await _localNotifications.show(
      message.hashCode,
      message.notification?.title ?? 'Nouvelle demande de course',
      message.notification?.body ?? 'Appuyez pour voir les détails',
      NotificationDetails(
        android: AndroidNotificationDetails(
          _rideRequestChannel.id,
          _rideRequestChannel.name,
          channelDescription: _rideRequestChannel.description,
          importance: Importance.max,
          priority: Priority.max,
          fullScreenIntent: true, // Android < 14 seulement
          icon: '@mipmap/ic_launcher',
          color: const Color(0xFF4F46E5),
          ongoing: false,
          autoCancel: true,
          timeoutAfter: 90000, // 90 secondes
          actions: [
            const AndroidNotificationAction('accept', 'Accepter'),
            const AndroidNotificationAction('refuse', 'Refuser'),
          ],
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentSound: true,
          presentBadge: true,
          interruptionLevel: InterruptionLevel.timeSensitive,
        ),
      ),
      payload: message.data['rideId'] as String?,
    );
  }

  static void _handleNotificationOpen(RemoteMessage message) {
    // La navigation est gérée par go_router via le payload stocké dans
    // la notification locale ou via le deep link dans message.data['route'].
  }

  @pragma('vm:entry-point')
  static void _onNotificationTapped(NotificationResponse response) {
    // Navigation traitée dans main.dart via app_links
  }

  @pragma('vm:entry-point')
  static void _onNotificationTappedBackground(NotificationResponse response) {
    // Navigation traitée au prochain démarrage de l'app
  }

  static Future<String?> getToken() =>
      FirebaseMessaging.instance.getToken();
}

