import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Button, Card, Loading, Route, Row, Screen, Spacer, T } from '@/components/ui';
import { api } from '@/lib/api';
import { eur, km } from '@/lib/format';
import { useRide } from '@/lib/hooks';
import { radius, useColors } from '@/lib/theme';

const WINDOW_S = 90;

/** Demande de course reçue : 90 secondes pour accepter. */
export default function RideOffer() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ride, loading } = useRide(id);
  const [left, setLeft] = useState(WINDOW_S);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ride) return;
    const start = new Date(ride.searching_at ?? ride.created_at).getTime();
    const tick = () => setLeft(Math.max(0, WINDOW_S - Math.floor((Date.now() - start) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [ride]);

  if (loading) return <Loading />;

  const gone = !ride || ride.status !== 'searching' || left === 0;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const accept = async () => {
    if (!ride) return;
    setBusy(true);
    try {
      await api.acceptRide(ride.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace(`/driver/ride/${ride.id}`);
    } catch (e) {
      setBusy(false);
      Alert.alert('Trop tard', (e as Error).message, [{ text: 'OK', onPress: close }]);
    }
  };

  if (gone) {
    return (
      <Screen title="Demande de course" back={false} footer={<Button title="Fermer" onPress={close} />}>
        <T variant="h2" center style={{ marginTop: 40 }}>Cette demande n&apos;est plus disponible</T>
        <T variant="small" center style={{ marginTop: 8 }}>Un autre chauffeur l&apos;a acceptée ou le délai est écoulé.</T>
      </Screen>
    );
  }

  const pct = left / WINDOW_S;
  return (
    <Screen title="Nouvelle demande" back={false}
      footer={
        <Row gap={12}>
          <Button title="Refuser" variant="secondary" onPress={close} style={{ flex: 1 }} />
          <Button title="Accepter" variant="success" onPress={accept} loading={busy} style={{ flex: 2 }} />
        </Row>
      }>
      <View style={{ alignItems: 'center', marginVertical: 20 }}>
        <T variant="big" color={left <= 20 ? c.danger : c.primary}>{left} s</T>
        <View style={{ height: 8, alignSelf: 'stretch', backgroundColor: c.surfaceAlt, borderRadius: radius.pill, marginTop: 10 }}>
          <View style={{ height: 8, width: `${pct * 100}%`, backgroundColor: left <= 20 ? c.danger : c.primary, borderRadius: radius.pill }} />
        </View>
      </View>
      <Card>
        <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <T variant="small">Vous recevrez</T>
          <T variant="title" color={c.success}>{eur(ride.price.driverEarningsEur)}</T>
        </Row>
        <Route from={ride.pickup_address} to={ride.dest_address} />
        <Spacer h={12} />
        <T variant="small">Trajet : {km(ride.distance_km)}</T>
      </Card>
      <T variant="small" center>En acceptant, vous vous engagez à rejoindre le passager rapidement.</T>
    </Screen>
  );
}
