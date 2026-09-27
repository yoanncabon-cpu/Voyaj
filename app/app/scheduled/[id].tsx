import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, Badge, Button, Card, ListItem, Loading, Route, Row, Screen, Spacer, Stars, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { dateTime, eur, km } from '@/lib/format';
import { pay } from '@/lib/payments';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import type { Booking, PublicProfile, ScheduledRide, Vehicle } from '@/lib/types';

/** Détail d'un trajet programmé : réservation (passager) ou gestion (chauffeur). */
export default function ScheduledDetail() {
  const c = useColors();
  const router = useRouter();
  const { userId, profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ride, setRide] = useState<ScheduledRide | null>(null);
  const [driver, setDriver] = useState<PublicProfile | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [myBooking, setMyBooking] = useState<Booking | null>(null);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [passengers, setPassengers] = useState<(Booking & { profile?: PublicProfile })[]>([]);
  const [seats, setSeats] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('scheduled_rides').select('*').eq('id', id).maybeSingle();
    const r = data as ScheduledRide | null;
    setRide(r);
    if (!r) return;
    const [{ data: d }, { data: v }, { data: bookings }] = await Promise.all([
      supabase.from('public_profiles').select('*').eq('id', r.driver_id).maybeSingle(),
      supabase.from('vehicles').select('*').eq('owner_id', r.driver_id).maybeSingle(),
      supabase.from('bookings').select('id, scheduled_ride_id, passenger_id, seats, amount_eur, status, penalty_eur, created_at')
        .eq('scheduled_ride_id', id).in('status', ['confirmed', 'completed']),
    ]);
    setDriver(d as PublicProfile);
    setVehicle(v as Vehicle);
    const bs = (bookings as Booking[]) ?? [];
    const mine = bs.find((b) => b.passenger_id === userId) ?? null;
    setMyBooking(mine);
    if (mine) {
      const { data: code } = await supabase.rpc('my_booking_code', { booking: mine.id });
      setMyCode(code as string | null);
    }
    if (r.driver_id === userId && bs.length) {
      const { data: profiles } = await supabase.from('public_profiles').select('*').in('id', bs.map((b) => b.passenger_id));
      setPassengers(bs.map((b) => ({ ...b, profile: (profiles as PublicProfile[])?.find((p) => p.id === b.passenger_id) })));
    }
  }, [id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!ride) return <Loading />;
  const isDriver = ride.driver_id === userId;
  const free = ride.seats - ride.booked_seats;
  const departed = new Date(ride.departure_at).getTime() < Date.now();

  const book = async () => {
    setBusy(true);
    try {
      const r = await api.book(ride.id, seats);
      const ok = await pay(r, profile?.name);
      if (ok) {
        const res = await api.confirmBooking(r.bookingId);
        Alert.alert('Réservation confirmée 🎉', `Votre code de prise en charge : ${res.pickupCode}`);
        await load();
      }
    } catch (e) {
      Alert.alert('Réservation impossible', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancelBooking = () => {
    if (!myBooking) return;
    const late = new Date(ride.departure_at).getTime() - Date.now() < 2 * 3_600_000;
    Alert.alert('Annuler la réservation ?', late ? 'Départ dans moins de 2 h : des frais d\'annulation sont retenus.' : 'Vous serez remboursé·e intégralement.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Annuler', style: 'destructive', onPress: async () => {
          try {
            const r = await api.cancelBooking(myBooking.id);
            Alert.alert('Réservation annulée', `Remboursement : ${eur(r.refundedEur)}${r.penaltyEur ? ` · frais : ${eur(r.penaltyEur)}` : ''}`);
            router.back();
          } catch (e) {
            Alert.alert('Erreur', (e as Error).message);
          }
        },
      },
    ]);
  };

  const cancelRide = () => Alert.alert('Annuler ce trajet ?', 'Tous les passagers seront remboursés intégralement.', [
    { text: 'Non', style: 'cancel' },
    {
      text: 'Annuler le trajet', style: 'destructive', onPress: async () => {
        try {
          await api.cancelScheduled(ride.id);
          router.back();
        } catch (e) {
          Alert.alert('Erreur', (e as Error).message);
        }
      },
    },
  ]);

  const openChat = async (other: string) => {
    const { data } = await supabase.rpc('get_or_create_conversation', { other });
    if (data) router.push(`/messages/${data}`);
  };

  return (
    <Screen title="Trajet"
      footer={!isDriver && !myBooking && !departed && ride.status === 'published' && free > 0 ? (
        <Button title={`Réserver · ${eur(ride.price.passengerTotalEur * seats)}`} onPress={book} loading={busy} icon="card" />
      ) : undefined}>
      <Card>
        <T variant="h2">{dateTime(ride.departure_at)}</T>
        <Spacer h={14} />
        <Route from={ride.origin_address} to={ride.dest_address} />
        <Spacer h={12} />
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="small">{km(ride.distance_km)} · {free} place{free > 1 ? 's' : ''} libre{free > 1 ? 's' : ''}</T>
          <T variant="h2" color={c.primary}>{eur(ride.price.passengerTotalEur)} / place</T>
        </Row>
        {ride.status === 'cancelled' && <View style={{ marginTop: 10 }}><Badge text="Annulé" tone="danger" /></View>}
      </Card>

      {driver && !isDriver && (
        <Card onPress={() => router.push(`/profile/${driver.id}`)}>
          <Row gap={12}>
            <Avatar name={driver.name} url={driver.avatar_url} />
            <View style={{ flex: 1 }}>
              <Row gap={8}><T variant="h2">{driver.name}</T>{driver.is_verified && <Badge text="Vérifié" tone="success" />}</Row>
              <Stars value={driver.rating} />
              {vehicle && <T variant="small">{vehicle.make} {vehicle.model}{vehicle.color ? ` · ${vehicle.color}` : ''}</T>}
            </View>
          </Row>
          <Button title="Contacter" icon="chatbubble" variant="secondary" onPress={() => openChat(driver.id)} style={{ marginTop: 12 }} />
        </Card>
      )}

      {!isDriver && myBooking && (
        <Card>
          <Badge text={myBooking.status === 'completed' ? 'Trajet effectué' : `Réservé · ${myBooking.seats} place(s)`} tone="success" />
          {myCode && myBooking.status === 'confirmed' && (
            <View style={{ alignItems: 'center', marginTop: 12 }}>
              <T variant="label">Code à donner au chauffeur</T>
              <T variant="big" color={c.primary} style={{ letterSpacing: 10 }}>{myCode}</T>
            </View>
          )}
          {myBooking.status === 'confirmed' && !departed && <Button title="Annuler ma réservation" variant="ghost" onPress={cancelBooking} />}
          {departed && (
            <>
              <Button title="Noter le chauffeur" variant="secondary" onPress={() => router.push(`/scheduled/rate?id=${ride.id}&user=${ride.driver_id}`)} />
              <Button title="Signaler un problème" variant="ghost" onPress={() => router.push(`/dispute/${ride.id}?kind=scheduled`)} />
            </>
          )}
        </Card>
      )}

      {!isDriver && !myBooking && free > 0 && ride.status === 'published' && !departed && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h2">Places à réserver</T>
            <Row gap={16}>
              <Pressable onPress={() => setSeats(Math.max(1, seats - 1))} hitSlop={10}><T variant="title" color={c.primary}>−</T></Pressable>
              <T variant="title">{seats}</T>
              <Pressable onPress={() => setSeats(Math.min(free, seats + 1))} hitSlop={10}><T variant="title" color={c.primary}>+</T></Pressable>
            </Row>
          </Row>
          <T variant="small" style={{ marginTop: 8 }}>Annulation gratuite jusqu&apos;à 2 h avant le départ.</T>
        </Card>
      )}

      {isDriver && (
        <>
          <T variant="label" style={{ marginBottom: 8 }}>Passagers ({ride.booked_seats}/{ride.seats})</T>
          {passengers.length === 0 ? <T variant="small">Pas encore de réservation.</T> : passengers.map((p) => (
            <ListItem key={p.id} icon="person" title={p.profile?.name ?? 'Passager'} subtitle={`${p.seats} place(s) · ${eur(p.amount_eur)}`}
              onPress={departed ? () => router.push(`/scheduled/rate?id=${ride.id}&user=${p.passenger_id}`) : () => openChat(p.passenger_id)}
              right={<T variant="small" color={c.primary}>{departed ? 'Noter' : 'Écrire'}</T>} />
          ))}
          <Spacer />
          <T variant="small">Vos gains ({eur(ride.price.driverEarningsEur)} par place) sont virés 24 h après le départ.</T>
          {!departed && ['published', 'full'].includes(ride.status) && (
            <Button title="Annuler ce trajet" variant="ghost" onPress={cancelRide} style={{ marginTop: 12 }} />
          )}
        </>
      )}
    </Screen>
  );
}
