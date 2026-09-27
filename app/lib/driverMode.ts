import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import type { Place } from '@/lib/api';

const KEY = 'voyaj.driver.destination';

/**
 * Mode chauffeur « en ligne » : la position est envoyée tant que l'app est
 * ouverte sur l'écran chauffeur. La destination est obligatoire (garde-fou
 * partage de frais : on prend des passagers sur SON trajet).
 *
 * Limite MVP : pas de suivi en arrière-plan (tâche de fond iOS/Android à
 * ajouter avec expo-task-manager avant le lancement public).
 */
export function useDriverMode(userId: string | null, activeRide: boolean) {
  const [online, setOnline] = useState(false);
  const [destination, setDestinationState] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);
  const watcherHeartbeat = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => v && setDestinationState(JSON.parse(v))).catch(() => {});
    if (!userId) return;
    supabase.from('driver_locations').select('is_online, updated_at').eq('driver_id', userId).maybeSingle()
      .then(({ data }) => {
        const fresh = data?.updated_at && Date.now() - new Date(data.updated_at).getTime() < 120_000;
        if (data?.is_online && fresh) setOnline(true);
      });
  }, [userId]);

  const setDestination = useCallback((p: Place | null) => {
    setDestinationState(p);
    if (p) AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
  }, []);

  const push = useCallback(async (coords: { latitude: number; longitude: number; heading?: number | null }, isOnline: boolean) => {
    if (!userId) return;
    await supabase.from('driver_locations').upsert({
      driver_id: userId,
      lat: coords.latitude,
      lng: coords.longitude,
      heading: coords.heading ?? null,
      is_online: isOnline,
      dest_lat: destination?.lat ?? null,
      dest_lng: destination?.lng ?? null,
      dest_address: destination?.address ?? null,
      updated_at: new Date().toISOString(),
    });
  }, [userId, destination]);

  // Envoi de la position tant qu'en ligne ou en course.
  const tracking = online || activeRide;
  useEffect(() => {
    if (!tracking || !userId) return;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Autorisez la localisation pour conduire');
        setOnline(false);
        return;
      }
      const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (cancelled) return;
      await push(first.coords, online);
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10_000, distanceInterval: 25 },
        (loc) => push(loc.coords, online),
      );
      // Rafraîchit updated_at même à l'arrêt (sinon le serveur nous croit hors ligne).
      const heartbeat = setInterval(async () => {
        const last = await Location.getLastKnownPositionAsync();
        if (last) push(last.coords, online);
      }, 45_000);
      if (cancelled) clearInterval(heartbeat);
      else watcherHeartbeat.current = heartbeat;
    })();
    return () => {
      cancelled = true;
      watcher.current?.remove();
      watcher.current = null;
      if (watcherHeartbeat.current) clearInterval(watcherHeartbeat.current);
    };
  }, [tracking, userId, online, push]);
  const goOnline = useCallback(() => {
    if (!destination) {
      setError('Indiquez d\'abord où vous allez');
      return;
    }
    setError(null);
    setOnline(true);
  }, [destination]);

  const goOffline = useCallback(async () => {
    setOnline(false);
    if (userId) await supabase.from('driver_locations').update({ is_online: false }).eq('driver_id', userId);
  }, [userId]);

  return { online, goOnline, goOffline, destination, setDestination, error };
}
