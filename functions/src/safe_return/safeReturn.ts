import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/admin';
import { unauthenticated, invalidArgument, notFound } from '../shared/errors';
import * as crypto from 'crypto';

interface StartSafeReturnParams {
  lat: number;
  lng: number;
  address: string;
  recipientName?: string;
  recipientPhone?: string; // format E.164, chiffré côté serveur
  updateIntervalMin?: number;
  rideId?: string;
}

interface UpdateSafeReturnParams {
  token: string;
  lat: number;
  lng: number;
  isArrived: boolean;
}

/**
 * Callable : démarre une session "Je suis bien rentré".
 * Génère un token unique (UUID v4) qui sert de lien public.
 */
export const startSafeReturn = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const data = request.data as StartSafeReturnParams;

    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') {
      throw invalidArgument('Position invalide');
    }

    const token = crypto.randomUUID();
    const now = FieldValue.serverTimestamp();

    await db.collection('safe_returns').doc(token).set({
      token,
      uid,
      startLat: data.lat,
      startLng: data.lng,
      currentLat: data.lat,
      currentLng: data.lng,
      address: data.address ?? '',
      recipientName: data.recipientName ?? null,
      rideId: data.rideId ?? null,
      isArrived: false,
      isExpired: false,
      updateIntervalMin: data.updateIntervalMin ?? 15,
      lastUpdateAt: now,
      createdAt: now,
      // Expire après 6 heures si pas de mise à jour
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    });

    // URL publique (sans auth) pour partager
    const publicUrl = `https://voyajapp.com/jsbr/${token}`;

    return { token, publicUrl };
  },
);

/**
 * Callable : met à jour la position en temps réel.
 */
export const updateSafeReturn = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const { token, lat, lng, isArrived } = request.data as UpdateSafeReturnParams;

    if (!token) throw invalidArgument('token manquant');

    const docRef = db.collection('safe_returns').doc(token);
    const snap = await docRef.get();
    if (!snap.exists) throw notFound('Session introuvable');
    if (snap.data()?.uid !== uid) throw invalidArgument('Token invalide');

    await docRef.update({
      currentLat: lat,
      currentLng: lng,
      isArrived,
      lastUpdateAt: FieldValue.serverTimestamp(),
      // Prolonger l'expiration à chaque mise à jour
      expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
    });

    return { success: true };
  },
);

/**
 * Cron : expire les sessions "Je suis bien rentré" non mises à jour depuis 6 h.
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';

export const expireSafeReturns = onSchedule(
  { schedule: 'every 30 minutes', region: 'europe-west1' },
  async () => {
    const now = new Date();
    const snapshot = await db
      .collection('safe_returns')
      .where('isExpired', '==', false)
      .where('isArrived', '==', false)
      .where('expiresAt', '<', now)
      .limit(50)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.update(doc.ref, {
        isExpired: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    console.log(`Expired ${snapshot.size} safe return sessions`);
  },
);
