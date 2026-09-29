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

export interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle: string;
  kind: 'city' | 'street' | 'address' | 'transport' | 'place';
  place: Place;
}

// Géoplateforme IGN (Base Adresse Nationale + points d'intérêt) : gratuit, sans clé, France entière.
const GEOCODER = 'https://data.geopf.fr/geocodage/search';
const NOISE = /administratif|lieu-dit|quartier|zone d'habitation|élément topographique/i;

type Feature = {
  geometry: { coordinates: [number, number] };
  properties: Record<string, unknown> & { _type: 'address' | 'poi' };
};

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;

function toSuggestion(f: Feature): PlaceSuggestion | null {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  if (p._type === 'poi') {
    const categories = ([] as string[]).concat((p.category as string[]) ?? []);
    if (categories.some((cat) => NOISE.test(cat))) return null;
    const name = first(p.name) ?? '';
    const city = first(p.city) ?? '';
    const isTransport = categories.some((cat) => /transport|gare|station|arrêt/i.test(cat));
    const joined = categories.join(' ').toLowerCase();
    const kindLabel =
      joined.includes('métro') ? 'Métro'
        : joined.includes('gare') ? 'Gare'
          : joined.includes('arrêt') ? 'Arrêt'
            : joined.includes('parking') ? 'Parking'
              : categories[0] ? categories[0][0].toUpperCase() + categories[0].slice(1) : 'Lieu';
    return {
      id: `poi:${name}:${lat.toFixed(4)}`,
      title: name,
      subtitle: [kindLabel, city].filter(Boolean).join(' · '),
      kind: isTransport ? 'transport' : 'place',
      place: { lat, lng, address: city && city !== name ? `${name}, ${city}` : name },
    };
  }
  const name = String(p.name ?? p.label ?? '');
  const city = String(p.city ?? '');
  const postcode = String(p.postcode ?? '');
  const department = String(p.context ?? '').split(',')[1]?.trim() ?? '';
  if (p.type === 'municipality') {
    return {
      id: `city:${p.citycode ?? name}`,
      title: city || name,
      subtitle: [postcode, department].filter(Boolean).join(' · '),
      kind: 'city',
      place: { lat, lng, address: `${city || name} (${postcode})` },
    };
  }
  return {
    id: `addr:${p.id ?? p.label}`,
    title: name,
    subtitle: `${postcode} ${city}`.trim(),
    kind: p.type === 'housenumber' ? 'address' : 'street',
    place: { lat, lng, address: `${name}, ${postcode} ${city}`.trim() },
  };
}

/** Dernière position connue, sans jamais déclencher de demande d'autorisation. */
async function quietPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const pos = await Location.getLastKnownPositionAsync();
    return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}

/** Suggestions pendant la saisie (villes, rues, adresses, gares…), triées par proximité si possible. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ q, autocomplete: '1', limit: '10', index: 'address,poi' });
  const near = await quietPosition();
  if (near) {
    params.set('lat', near.lat.toFixed(4));
    params.set('lon', near.lng.toFixed(4));
  }
  const res = await fetch(`${GEOCODER}?${params}`, { signal });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const json = (await res.json()) as { features: Feature[] };
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const f of json.features ?? []) {
    const s = toSuggestion(f);
    if (!s || !s.title) continue;
    const key = `${s.title}|${s.subtitle}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length === 6) break;
  }
  return out;
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
