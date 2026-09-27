package com.voyaj.app

import io.flutter.embedding.android.FlutterActivity

/**
 * Activité plein écran (écran verrouillé) ouverte par la notification
 * haute priorité d'une demande de course. Réutilise le moteur Flutter :
 * la route /driver/request/{rideId} est poussée via le payload de la notification.
 */
class RideRequestFullScreenActivity : FlutterActivity()
