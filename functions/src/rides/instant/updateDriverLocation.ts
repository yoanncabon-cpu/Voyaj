import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../../shared/admin';
import { unauthenticated, invalidArgument } from '../../shared/errors';

interface UpdateLocationParams {
  lat: number;
  lng: number;
  geohash: string;
  heading?: number;
  speedKmh?: number;
  isOnline: boolean;
}

/**
 * Callable : le chauffeur met à jour sa position GPS.
 * Écrit dans /users/{uid} (pas dans une collection séparée pour simplifier les rules).
 * En mode "en ligne", met aussi à jour le geohash pour la recherche de proximité.
 */
export const updateDriverLocation = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const { lat, lng, geohash, heading, speedKmh, isOnline } =
      request.data as UpdateLocationParams;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw invalidArgument('lat/lng invalides');
    }
    if (typeof geohash !== 'string' || geohash.length < 5) {
      throw invalidArgument('geohash invalide');
    }

    const updateData: Record<string, unknown> = {
      lastLat: lat,
      lastLng: lng,
      'g.geohash': geohash,
      'g.geopoint': { latitude: lat, longitude: lng },
      isOnline,
      lastLocationUpdate: FieldValue.serverTimestamp(),
    };

    if (heading != null) updateData.heading = heading;
    if (speedKmh != null) updateData.speedKmh = speedKmh;

    await db.collection('users').doc(uid).update(updateData);

    return { success: true };
  },
);
