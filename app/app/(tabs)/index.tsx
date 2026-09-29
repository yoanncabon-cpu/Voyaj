import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AddressField } from '@/components/AddressField';
import { RideMap, type LatLng } from '@/components/RideMap';
import { Badge, Button, Card, ListItem, Route, Row, shadow, T, tap } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useDriverMode } from '@/lib/driverMode';
import { eur, km, RIDE_STATUS_LABEL } from '@/lib/format';
import { useActiveRide, useRideOffers } from '@/lib/hooks';
import { currentPlace } from '@/lib/location';
import { radius, space, useColors } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

type Mode = 'passenger' | 'driver';

export default function Home() {
  const c = useColors();
  const { userId, profile } = useAuth();
  const [mode, setMode] = useState<Mode>('passenger');
  const [me, setMe] = useState<LatLng | null>(null);
  const { ride } = useActiveRide(userId);

  useEffect(() => {
    currentPlace().then((p) => p && setMe({ lat: p.lat, lng: p.lng })).catch(() => {});
  }, []);

  // Une course en cours impose le bon mode.
  useEffect(() => {
    if (ride && userId) setMode(ride.driver_id === userId ? 'driver' : 'passenger');
  }, [ride, userId]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <RideMap me={me} pickup={ride ? { lat: ride.pickup_lat, lng: ride.pickup_lng } : null}
        dest={ride ? { lat: ride.dest_lat, lng: ride.dest_lng } : null} />
      <SafeAreaView edges={['top']} style={{ paddingHorizontal: space.md }}>
        <View style={[styles.toggle, { backgroundColor: c.surface, borderColor: c.border }, shadow.soft]}>
          {(['passenger', 'driver'] as const).map((m) => (
            <Pressable key={m} onPress={() => { if (!ride && mode !== m) { tap(); setMode(m); } }}
              style={[styles.toggleItem, mode === m && { backgroundColor: c.primary }]}
              accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
              <Ionicons name={m === 'passenger' ? 'person' : 'car'} size={16} color={mode === m ? c.onPrimary : c.textSecondary} />
              <T variant="small" color={mode === m ? c.onPrimary : c.textSecondary} style={{ fontWeight: '700' }}>
                {m === 'passenger' ? 'Passager' : 'Chauffeur'}
              </T>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
      <View style={[styles.sheet, { backgroundColor: c.bg }, shadow.raised]}>
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.md }} keyboardShouldPersistTaps="handled">
          {ride ? <ActiveRideCard rideId={ride.id} isDriver={ride.driver_id === userId} status={RIDE_STATUS_LABEL[ride.status]}
            from={ride.pickup_address} to={ride.dest_address} price={ride.driver_id === userId ? ride.price.driverEarningsEur : ride.price.passengerTotalEur} />
            : mode === 'passenger' ? <PassengerPanel firstName={profile?.name?.split(' ')[0]} userId={userId} />
              : <DriverPanel verified={!!profile?.is_verified} />}
        </ScrollView>
      </View>
    </View>
  );
}

function ActiveRideCard({ rideId, isDriver, status, from, to, price }: {
  rideId: string; isDriver: boolean; status: string; from: string; to: string; price: number;
}) {
  const router = useRouter();
  return (
    <Card onPress={() => router.push(isDriver ? `/driver/ride/${rideId}` : `/ride/${rideId}`)}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Badge text={status} tone="primary" />
        <T variant="h2">{eur(price)}</T>
      </Row>
      <Route from={from} to={to} />
      <Button title="Voir la course" icon="arrow-forward" onPress={() => router.push(isDriver ? `/driver/ride/${rideId}` : `/ride/${rideId}`)}
        style={{ marginTop: 16 }} />
    </Card>
  );
}

type Recent = { lat: number; lng: number; address: string };

/** Dernières destinations distinctes du passager (courses instantanées). */
function useRecentDestinations(userId: string | null) {
  const [recents, setRecents] = useState<Recent[]>([]);
  useEffect(() => {
    if (!userId) return;
    supabase.from('rides').select('dest_lat, dest_lng, dest_address')
      .eq('passenger_id', userId).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => {
        const seen = new Set<string>();
        const out: Recent[] = [];
        for (const r of data ?? []) {
          const key = String(r.dest_address).toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ lat: r.dest_lat, lng: r.dest_lng, address: r.dest_address });
          if (out.length === 3) break;
        }
        setRecents(out);
      });
  }, [userId]);
  return recents;
}

function greeting(): string {
  const h = new Date().getHours();
  return h >= 18 || h < 5 ? 'Bonsoir' : 'Bonjour';
}

function PassengerPanel({ firstName, userId }: { firstName?: string; userId: string | null }) {
  const c = useColors();
  const router = useRouter();
  const recents = useRecentDestinations(userId);
  return (
    <>
      <T variant="title">{greeting()}{firstName ? ` ${firstName}` : ''}</T>
      <T color={c.textSecondary} style={{ marginTop: 2, marginBottom: space.md }}>Où allons-nous aujourd&apos;hui ?</T>

      <Pressable onPress={() => { tap(); router.push('/ride/new'); }} accessibilityRole="button" accessibilityLabel="Rechercher une destination"
        style={({ pressed }) => [styles.search, { backgroundColor: c.surface, borderColor: c.border, transform: [{ scale: pressed ? 0.985 : 1 }] }, shadow.soft]}>
        <View style={[styles.searchIcon, { backgroundColor: c.accent }]}>
          <Ionicons name="search" size={18} color={c.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <T variant="h2">Où allez-vous ?</T>
          <T variant="small">Ville, adresse, gare…</T>
        </View>
        <View style={[styles.nowPill, { backgroundColor: c.surfaceAlt }]}>
          <Ionicons name="flash" size={13} color={c.primary} />
          <T variant="small" color={c.text} style={{ fontWeight: '700' }}>Maintenant</T>
        </View>
      </Pressable>

      {recents.length > 0 && (
        <View style={{ marginTop: space.md }}>
          {recents.map((r) => (
            <ListItem key={r.address} icon="time-outline" title={r.address.split(',')[0]} subtitle={r.address.split(',').slice(1).join(',').trim() || undefined}
              onPress={() => router.push({ pathname: '/ride/new', params: { destLat: String(r.lat), destLng: String(r.lng), destAddress: r.address } })} />
          ))}
        </View>
      )}

      <Row gap={space.sm} style={{ marginTop: space.md }}>
        <Card style={{ flex: 1 }} onPress={() => router.push('/(tabs)/trajets')}>
          <View style={[styles.cardIcon, { backgroundColor: c.primarySoft }]}>
            <Ionicons name="calendar" size={20} color={c.primary} />
          </View>
          <T variant="h2">Covoiturage</T>
          <T variant="small">Trajets programmés</T>
        </Card>
        <Card style={{ flex: 1 }} onPress={() => router.push('/safe-return')}>
          <View style={[styles.cardIcon, { backgroundColor: c.accentSoft }]}>
            <Ionicons name="home" size={20} color={c.success} />
          </View>
          <T variant="h2">Bien rentré</T>
          <T variant="small">Partager mon retour</T>
        </Card>
      </Row>
    </>
  );
}

function DriverPanel({ verified }: { verified: boolean }) {
  const c = useColors();
  const router = useRouter();
  const { userId } = useAuth();
  const [hasVehicle, setHasVehicle] = useState<boolean | null>(null);
  const { online, goOnline, goOffline, destination, setDestination, error } = useDriverMode(userId, false);
  const offers = useRideOffers(userId, online);

  useEffect(() => {
    if (!userId) return;
    supabase.from('vehicles').select('owner_id').eq('owner_id', userId).maybeSingle()
      .then(({ data }) => setHasVehicle(!!data));
  }, [userId]);

  if (!verified || hasVehicle === false) {
    return (
      <Card>
        <T variant="h2">Devenir chauffeur</T>
        <T variant="small" style={{ marginTop: 6, marginBottom: 8 }}>Deux étapes avant de prendre des passagers :</T>
        <ListItem icon="id-card" title="Vérifier mon identité" subtitle={verified ? 'Validée' : 'Pièce d\'identité à envoyer'}
          onPress={verified ? undefined : () => router.push('/profile/verification')}
          right={verified ? <Ionicons name="checkmark-circle" size={22} color={c.success} /> : undefined} />
        <ListItem icon="car" title="Enregistrer mon véhicule" subtitle={hasVehicle ? 'Enregistré' : 'Marque, modèle, plaque'}
          onPress={hasVehicle ? undefined : () => router.push('/profile/vehicle')}
          right={hasVehicle ? <Ionicons name="checkmark-circle" size={22} color={c.success} /> : undefined} />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T variant="h2">{online ? 'En ligne' : 'Hors ligne'}</T>
            <T variant="small">{online ? 'Vous recevez les demandes proches de vous' : 'Passez en ligne pour recevoir des courses'}</T>
          </View>
          <Switch value={online} onValueChange={(v) => (v ? goOnline() : goOffline())}
            trackColor={{ true: c.success, false: c.border }} accessibilityLabel="En ligne" />
        </Row>
        {!online && (
          <View style={{ marginTop: space.md }}>
            <AddressField label="Où allez-vous ?" value={destination} onChange={setDestination}
              placeholder="Votre destination (obligatoire)" />
          </View>
        )}
        {online && destination && <T variant="small" style={{ marginTop: 8 }}>Direction : {destination.address}</T>}
        {!!error && <T color={c.danger} style={{ marginTop: 8 }}>{error}</T>}
      </Card>
      {online && offers.map((o) => (
        <Card key={o.id} onPress={() => router.push(`/driver/offer/${o.id}`)}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <Badge text="Nouvelle demande" tone="warning" />
            <T variant="h2" color={c.success}>{eur(o.price.driverEarningsEur)}</T>
          </Row>
          <Route from={o.pickup_address} to={o.dest_address} />
          <T variant="small" style={{ marginTop: 8 }}>{km(o.distance_km)}</T>
        </Card>
      ))}
      {online && offers.length === 0 && (
        <T variant="small" center style={{ marginTop: 8 }}>En attente de demandes… Gardez l&apos;app ouverte.</T>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignSelf: 'center', borderRadius: radius.pill, padding: 4, borderWidth: StyleSheet.hairlineWidth, marginTop: space.sm },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 18, borderRadius: radius.pill },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '66%', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 10, marginBottom: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: radius.lg - 4, borderWidth: StyleSheet.hairlineWidth },
  searchIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nowPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  cardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
});
