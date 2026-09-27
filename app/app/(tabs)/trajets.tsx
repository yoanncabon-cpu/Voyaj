import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, Button, Card, Empty, Field, Route, Row, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { dateTime, eur } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { radius, space, useColors } from '@/lib/theme';
import type { Booking, ScheduledRide } from '@/lib/types';

type Tab = 'search' | 'mine';

export default function Trajets() {
  const c = useColors();
  const router = useRouter();
  const { userId } = useAuth();
  const [tab, setTab] = useState<Tab>('search');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [results, setResults] = useState<ScheduledRide[]>([]);
  const [myRides, setMyRides] = useState<ScheduledRide[]>([]);
  const [myBookings, setMyBookings] = useState<(Booking & { ride: ScheduledRide | null })[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const search = useCallback(async () => {
    let q = supabase.from('scheduled_rides').select('*')
      .eq('status', 'published').gt('departure_at', new Date().toISOString())
      .order('departure_at').limit(50);
    if (userId) q = q.neq('driver_id', userId);
    if (from.trim()) q = q.ilike('origin_address', `%${from.trim()}%`);
    if (to.trim()) q = q.ilike('dest_address', `%${to.trim()}%`);
    const { data } = await q;
    setResults((data as ScheduledRide[]) ?? []);
  }, [from, to, userId]);

  const loadMine = useCallback(async () => {
    if (!userId) return;
    const [{ data: rides }, { data: bookings }] = await Promise.all([
      supabase.from('scheduled_rides').select('*').eq('driver_id', userId)
        .in('status', ['published', 'full']).order('departure_at'),
      supabase.from('bookings').select('id, scheduled_ride_id, passenger_id, seats, amount_eur, status, penalty_eur, created_at')
        .eq('passenger_id', userId).in('status', ['confirmed', 'completed']).order('created_at', { ascending: false }).limit(30),
    ]);
    setMyRides((rides as ScheduledRide[]) ?? []);
    const bs = (bookings as Booking[]) ?? [];
    const ids = [...new Set(bs.map((b) => b.scheduled_ride_id))];
    const { data: linked } = ids.length ? await supabase.from('scheduled_rides').select('*').in('id', ids) : { data: [] };
    setMyBookings(bs.map((b) => ({ ...b, ride: (linked as ScheduledRide[]).find((r) => r.id === b.scheduled_ride_id) ?? null })));
  }, [userId]);

  useFocusEffect(useCallback(() => {
    search();
    loadMine();
  }, [search, loadMine]));

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([search(), loadMine()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={{ padding: space.md, paddingBottom: 0 }}>
        <T variant="title">Trajets</T>
        <Row style={{ marginTop: space.md, backgroundColor: c.surfaceAlt, borderRadius: radius.pill, padding: 4 }} gap={0}>
          {(['search', 'mine'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: tab === t ? c.surface : 'transparent' }}>
              <T center style={{ fontWeight: '700' }} color={tab === t ? c.text : c.textSecondary}>{t === 'search' ? 'Rechercher' : 'Mes trajets'}</T>
            </Pressable>
          ))}
        </Row>
      </View>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 60 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {tab === 'search' ? (
          <>
            <Card>
              <Field label="Départ" value={from} onChangeText={setFrom} placeholder="Ville de départ" />
              <Field label="Arrivée" value={to} onChangeText={setTo} placeholder="Ville d'arrivée" onSubmitEditing={search} returnKeyType="search" />
              <Button title="Rechercher" icon="search" onPress={search} />
            </Card>
            {results.length === 0 ? (
              <Empty icon="car-outline" title="Aucun trajet trouvé" text="Publiez une demande : les conducteurs qui font ce trajet la verront."
                action={<Button title="Publier une demande" variant="secondary" onPress={() => router.push('/scheduled/request')} />} />
            ) : results.map((r) => <TripCard key={r.id} ride={r} onPress={() => router.push(`/scheduled/${r.id}`)} />)}
          </>
        ) : (
          <>
            <Button title="Publier un trajet" icon="add-circle" onPress={() => router.push('/scheduled/publish')} />
            <T variant="label" style={{ marginTop: space.lg, marginBottom: space.sm }}>Mes réservations</T>
            {myBookings.length === 0 ? <T variant="small">Aucune réservation.</T> : myBookings.map((b) => b.ride && (
              <TripCard key={b.id} ride={b.ride} badge={b.status === 'completed' ? 'Effectué' : `${b.seats} place(s) réservée(s)`}
                onPress={() => router.push(`/scheduled/${b.scheduled_ride_id}`)} />
            ))}
            <T variant="label" style={{ marginTop: space.lg, marginBottom: space.sm }}>Mes trajets publiés</T>
            {myRides.length === 0 ? <T variant="small">Aucun trajet publié.</T> : myRides.map((r) => (
              <TripCard key={r.id} ride={r} badge={`${r.booked_seats}/${r.seats} places réservées`} onPress={() => router.push(`/scheduled/${r.id}`)} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TripCard({ ride, onPress, badge }: { ride: ScheduledRide; onPress: () => void; badge?: string }) {
  const c = useColors();
  const free = ride.seats - ride.booked_seats;
  return (
    <Card onPress={onPress}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <T variant="small" style={{ fontWeight: '700' }}>{dateTime(ride.departure_at)}</T>
        <T variant="h2" color={c.primary}>{eur(ride.price.passengerTotalEur)}</T>
      </Row>
      <Route from={ride.origin_address} to={ride.dest_address} />
      <View style={{ marginTop: 12 }}>
        <Badge text={badge ?? `${free} place${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''}`} tone={badge ? 'primary' : free > 0 ? 'success' : 'neutral'} />
      </View>
    </Card>
  );
}
