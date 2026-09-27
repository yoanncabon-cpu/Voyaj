import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RideMap } from '@/components/RideMap';
import { Avatar, Badge, Button, Loading, Route, Row, Stars, T } from '@/components/ui';
import { api } from '@/lib/api';
import { eur, RIDE_STATUS_LABEL } from '@/lib/format';
import { useDriverPosition, useRide } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { radius, space, useColors } from '@/lib/theme';
import type { PublicProfile } from '@/lib/types';

/** Suivi en direct côté passager. */
export default function RideTracking() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ride, loading } = useRide(id);
  const [driver, setDriver] = useState<PublicProfile | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const live = !!ride && ['accepted', 'pickup', 'in_progress'].includes(ride.status);
  const driverPos = useDriverPosition(ride?.driver_id, live);

  useEffect(() => {
    if (!ride?.driver_id) return;
    supabase.from('public_profiles').select('*').eq('id', ride.driver_id).maybeSingle()
      .then(({ data }) => setDriver(data as PublicProfile));
  }, [ride?.driver_id]);

  useEffect(() => {
    if (!id) return;
    supabase.from('ride_secrets').select('pickup_code').eq('ride_id', id).maybeSingle()
      .then(({ data }) => setCode(data?.pickup_code ?? null));
  }, [id, ride?.status]);

  useEffect(() => {
    if (ride?.status === 'confirmed') router.replace(`/ride/summary/${ride.id}`);
  }, [ride?.status, ride?.id, router]);

  if (loading || !ride) return <Loading />;

  const act = async (action: 'cancel' | 'confirm') => {
    setBusy(true);
    try {
      const r = await api.rideAction(ride.id, action);
      if (action === 'cancel') {
        Alert.alert('Course annulée', r.penaltyEur ? `Des frais d'annulation de ${eur(r.penaltyEur)} ont été retenus.` : 'Vous n\'avez pas été débité·e.');
        router.replace('/(tabs)');
      }
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = () => {
    const late = ride.status === 'pickup' || (ride.status === 'accepted' && ride.accepted_at &&
      Date.now() - new Date(ride.accepted_at).getTime() > 120_000);
    Alert.alert('Annuler la course ?', late ? 'Le chauffeur est déjà en route : des frais d\'annulation s\'appliquent.' : 'Annulation gratuite.', [
      { text: 'Non', style: 'cancel' },
      { text: 'Annuler la course', style: 'destructive', onPress: () => act('cancel') },
    ]);
  };

  const ended = ['cancelled', 'expired', 'passenger_absent'].includes(ride.status);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <RideMap pickup={{ lat: ride.pickup_lat, lng: ride.pickup_lng }} dest={{ lat: ride.dest_lat, lng: ride.dest_lng }} driver={driverPos} />
      <SafeAreaView edges={['top']} style={{ padding: space.md }}>
        <Button title="Accueil" icon="chevron-back" variant="secondary" onPress={() => router.replace('/(tabs)')}
          style={{ alignSelf: 'flex-start', minHeight: 40, paddingHorizontal: 14 }} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={[styles.panel, { backgroundColor: c.surface }]}>
        <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
          <Row>
            {ride.status === 'searching' && <ActivityIndicator color={c.primary} />}
            <T variant="h2">{RIDE_STATUS_LABEL[ride.status]}</T>
          </Row>
          <T variant="h2" color={c.primary}>{eur(ride.price.passengerTotalEur)}</T>
        </Row>

        {driver && !ended && (
          <Row style={{ marginBottom: space.md }} gap={12}>
            <Avatar name={driver.name} url={driver.avatar_url} />
            <View style={{ flex: 1 }}>
              <Row gap={8}><T variant="h2">{driver.name}</T>{driver.is_verified && <Badge text="Vérifié" tone="success" />}</Row>
              <Stars value={driver.rating} />
              {!!ride.vehicle_description && <T variant="small">{ride.vehicle_description}</T>}
            </View>
            <Button title="" icon="chatbubble" variant="secondary" style={{ minHeight: 44, paddingHorizontal: 12 }}
              onPress={async () => {
                const { data } = await supabase.rpc('get_or_create_conversation', { other: driver.id });
                if (data) router.push(`/messages/${data}`);
              }} />
          </Row>
        )}

        {code && ['accepted', 'pickup'].includes(ride.status) && (
          <View style={[styles.code, { backgroundColor: c.primarySoft }]}>
            <T variant="label" color={c.primary}>Code à donner au chauffeur</T>
            <T variant="big" color={c.primary} style={{ letterSpacing: 10 }}>{code}</T>
          </View>
        )}

        <Route from={ride.pickup_address} to={ride.dest_address} />

        <View style={{ marginTop: space.md, gap: space.sm }}>
          {ride.status === 'ended' && (
            <Button title="Je suis bien arrivé·e — confirmer" variant="success" icon="checkmark-circle" loading={busy} onPress={() => act('confirm')} />
          )}
          {['searching', 'accepted', 'pickup'].includes(ride.status) && (
            <Button title="Annuler la course" variant="secondary" onPress={confirmCancel} loading={busy} />
          )}
          {ride.status === 'in_progress' && (
            <Button title="Urgence — appeler le 112" variant="danger" icon="call" onPress={() => Linking.openURL('tel:112')} />
          )}
          {ended && <Button title="Retour à l'accueil" onPress={() => router.replace('/(tabs)')} />}
          {['ended', 'passenger_absent', 'cancelled'].includes(ride.status) && !ride.has_dispute && (
            <Button title="Signaler un problème" variant="ghost" onPress={() => router.push(`/dispute/${ride.id}?kind=instant`)} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  code: { alignItems: 'center', padding: space.md, borderRadius: radius.md, marginBottom: space.md },
});
