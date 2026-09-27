import * as Location from 'expo-location';
import type { Place } from '@/lib/api';

export async function ensureLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/** Position actuelle + adresse lisible. */
export async function currentPlace(): Promise<Place | null> {
  if (!(await ensureLocationPermission())) return null;
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  const { latitude: lat, longitude: lng } = pos.coords;
  return { lat, lng, address: await reverseGeocode(lat, lng) };
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (a) {
      const street = [a.streetNumber, a.street].filter(Boolean).join(' ');
      return [street || a.name, a.city].filter(Boolean).join(', ') || 'Position actuelle';
    }
  } catch {
    // géocodeur indisponible
  }
  return 'Position actuelle';
}

/**
 * Adresse saisie → coordonnées (géocodeur du téléphone, sans clé d'API).
 * On ajoute « France » pour éviter les homonymes à l'étranger.
 */
export async function geocode(address: string): Promise<Place | null> {
  const q = address.trim();
  if (q.length < 3) return null;
  try {
    const results = await Location.geocodeAsync(/france/i.test(q) ? q : `${q}, France`);
    const r = results[0];
    if (!r) return null;
    return { lat: r.latitude, lng: r.longitude, address: q };
  } catch {
    return null;
  }
}
