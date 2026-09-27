import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { RideMap } from '@/components/RideMap';
import { Avatar, Button, Loading, Route, Row, Stars, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useDriverMode } from '@/lib/driverMode';
import { eur, RIDE_STATUS_LABEL } from '@/lib/format';
import { useRide } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { radius, space, useColors } from '@/lib/theme';
import type { PublicProfile } from '@/lib/types';

/** Conduite d'une course : arrivé → code → départ → fin. */
export default function DriverRide() {
  const c = useColors();
  const router = useRouter();
  const { userId } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ride, loading } = useRide(id);
  const [passenger, setPassenger] = useState<PublicProfile | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [waitLeft, setWaitLeft] = useState<number | null>(null);
  // Position partagée avec le passager pendant toute la course.
  useDriverMode(userId, !!ride && ['accepted', 'pickup', 'in_progress'].includes(ride.status));

  useEffect(() => {
    if (!ride?.passenger_id) return;
    supabase.from('public_profiles').select('*').eq('id', ride.passenger_id).maybeSingle()
      .then(({ data }) => setPassenger(data as PublicProfile));
  }, [ride?.passenger_id]);

  // 5 minutes d'attente avant de pouvoir signaler une absence.
  useEffect(() => {
    if (ride?.status !== 'pickup' || !ride.arrived_at) return setWaitLeft(null);
    const arrived = new Date(ride.arrived_at).getTime();
    const tick = () => setWaitLeft(Math.max(0, 300 - Math.floor((Date.now() - arrived) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [ride?.status, ride?.arrived_at]);

  useEffect(() => {
    if (ride && ['ended', 'confirmed'].includes(ride.status)) router.replace(`/ride/summary/${ride.id}`);
  }, [ride?.status, ride?.id, router, ride]);

  if (loading || !ride) return <Loading />;

  const run = async (action: 'arrive' | 'start' | 'end' | 'cancel' | 'report_absent', extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      if (action === 'start') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null);
        if (pos) Object.assign(extra, { lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
      await api.rideAction(ride.id, action, extra);
      if (action === 'cancel' || action === 'report_absent') router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Action impossible', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const navigate = (lat: number, lng: number) => {
    const url = Platform.OS === 'ios' ? `maps://?daddr=${lat},${lng}` : `google.navigation:q=${lat},${lng}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`));
  };

  const target = ride.status === 'in_progress'
    ? { lat: ride.dest_lat, lng: ride.dest_lng }
    : { lat: ride.pickup_lat, lng: ride.pickup_lng };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <RideMap pickup={{ lat: ride.pickup_lat, lng: ride.pickup_lng }} dest={{ lat: ride.dest_lat, lng: ride.dest_lng }} />
      <SafeAreaView edges={['top']} style={{ padding: space.md }}>
        <Row gap={8}>
          <Button title="Accueil" icon="chevron-back" variant="secondary" onPress={() => router.replace('/(tabs)')}
            style={{ minHeight: 40, paddingHorizontal: 14 }} />
          <Button title="GPS" icon="navigate" onPress={() => navigate(target.lat, target.lng)} style={{ minHeight: 40, paddingHorizontal: 14 }} />
        </Row>
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={[styles.panel, { backgroundColor: c.surface }]}>
        <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
          <T variant="h2">{RIDE_STATUS_LABEL[ride.status]}</T>
          <T variant="h2" color={c.success}>{eur(ride.price.driverEarningsEur)}</T>
        </Row>
        {passenger && (
          <Row gap={12} style={{ marginBottom: space.md }}>
            <Avatar name={passenger.name} url={passenger.avatar_url} size={42} />
            <View style={{ flex: 1 }}>
              <T variant="h2">{passenger.name}</T>
              <Stars value={passenger.rating} />
            </View>
            <Button title="" icon="chatbubble" variant="secondary" style={{ minHeight: 44, paddingHorizontal: 12 }}
              onPress={async () => {
                const { data } = await supabase.rpc('get_or_create_conversation', { other: passenger.id });
                if (data) router.push(`/messages/${data}`);
              }} />
          </Row>
        )}
        <Route from={ride.pickup_address} to={ride.dest_address} />
        <View style={{ marginTop: space.md, gap: space.sm }}>
          {ride.status === 'accepted' && (
            <>
              <Button title="Je suis arrivé" icon="location" loading={busy} onPress={() => run('arrive')} />
              <Button title="Annuler" variant="ghost" onPress={() => Alert.alert('Annuler la course ?',
                'Le passager sera remboursé et un avertissement sera ajouté à votre compte.', [
                  { text: 'Non', style: 'cancel' },
                  { text: 'Annuler', style: 'destructive', onPress: () => run('cancel') },
                ])} />
            </>
          )}
          {ride.status === 'pickup' && (
            <>
              <TextInput value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad"
                placeholder="Code du passager" placeholderTextColor={c.textMuted} maxLength={4}
                style={[styles.code, { borderColor: c.border, color: c.text, backgroundColor: c.bg }]} />
              <Button title="Démarrer la course" variant="success" loading={busy} disabled={code.length !== 4}
                onPress={() => run('start', { pickupCode: code })} />
              {waitLeft != null && (waitLeft > 0
                ? <T variant="small" center>Passager absent ? Signalement possible dans {Math.floor(waitLeft / 60)}:{String(waitLeft % 60).padStart(2, '0')}</T>
                : <Button title="Signaler le passager absent" variant="ghost" onPress={() => run('report_absent')} />)}
            </>
          )}
          {ride.status === 'in_progress' && (
            <Button title="Fin de course" icon="flag" loading={busy} onPress={() => run('end')} />
          )}
          {['cancelled', 'expired', 'passenger_absent'].includes(ride.status) && (
            <Button title="Retour à l'accueil" onPress={() => router.replace('/(tabs)')} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  code: { borderWidth: 1, borderRadius: radius.sm, fontSize: 30, fontWeight: '800', letterSpacing: 14, textAlign: 'center', paddingVertical: 12 },
});
