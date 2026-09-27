import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ACTIVE_STATUSES } from '@/lib/format';
import type { Ride } from '@/lib/types';

/** Course en cours de l'utilisateur (passager ou chauffeur), mise à jour en temps réel. */
export function useActiveRide(userId: string | null) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('rides').select('*')
      .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setRide((data as Ride) ?? null);
    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`active-rides-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `passenger_id=eq.${userId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `driver_id=eq.${userId}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  return { ride, loading, reload: load };
}

/** Une course précise, en temps réel. */
export function useRide(rideId: string | undefined) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!rideId) return;
    const { data } = await supabase.from('rides').select('*').eq('id', rideId).maybeSingle();
    setRide((data as Ride) ?? null);
    setLoading(false);
  }, [rideId]);

  useEffect(() => {
    load();
    if (!rideId) return;
    const channel = supabase.channel(`ride-${rideId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` },
        (p) => setRide(p.new as Ride))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, load]);

  return { ride, loading, reload: load };
}

/** Position du chauffeur (visible par son passager pendant la course). */
export function useDriverPosition(driverId: string | null | undefined, enabled: boolean) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!driverId || !enabled) return;
    supabase.from('driver_locations').select('lat, lng').eq('driver_id', driverId).maybeSingle()
      .then(({ data }) => data && setPos({ lat: data.lat, lng: data.lng }));
    const channel = supabase.channel(`driver-pos-${driverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
        (p) => {
          const n = p.new as { lat?: number; lng?: number };
          if (n?.lat != null && n?.lng != null) setPos({ lat: n.lat, lng: n.lng });
        })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, enabled]);
  return pos;
}

/** Demandes de course proposées au chauffeur (filet de sécurité si la notification n'arrive pas). */
export function useRideOffers(driverId: string | null, enabled: boolean) {
  const [offers, setOffers] = useState<Ride[]>([]);
  const load = useCallback(async () => {
    if (!driverId || !enabled) return setOffers([]);
    const since = new Date(Date.now() - 90_000).toISOString();
    const { data } = await supabase.from('rides').select('*')
      .eq('status', 'searching').gt('searching_at', since).order('searching_at', { ascending: false });
    setOffers((data as Ride[]) ?? []);
  }, [driverId, enabled]);

  useEffect(() => {
    load();
    if (!driverId || !enabled) return;
    const channel = supabase.channel(`offers-${driverId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_offers', filter: `driver_id=eq.${driverId}` }, load)
      .subscribe();
    const timer = setInterval(load, 15_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [driverId, enabled, load]);
  return offers;
}
