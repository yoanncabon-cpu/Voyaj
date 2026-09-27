import { useState } from 'react';
import { Alert, Platform, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AddressField } from '@/components/AddressField';
import { Button, Card, Row, Screen, T } from '@/components/ui';
import { api, type Place } from '@/lib/api';
import { dateTime, eur } from '@/lib/format';
import { useColors } from '@/lib/theme';

export default function Publish() {
  const c = useColors();
  const router = useRouter();
  const [origin, setOrigin] = useState<Place | null>(null);
  const [dest, setDest] = useState<Place | null>(null);
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 24 * 3_600_000);
    d.setMinutes(0, 0, 0);
    return d;
  });
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [seats, setSeats] = useState(3);
  const [daily, setDaily] = useState(false);
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    if (!origin || !dest) return;
    setBusy(true);
    try {
      const r = await api.publishScheduled({ origin, dest, departureAt: date.toISOString(), seats, recurringDaily: daily });
      Alert.alert('Trajet publié 🎉', `Prix par passager : ${eur(r.price.passengerTotalEur)}`, [
        { text: 'OK', onPress: () => router.replace(`/scheduled/${r.scheduledRideId}`) },
      ]);
    } catch (e) {
      Alert.alert('Publication impossible', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Publier un trajet"
      footer={<Button title="Publier" onPress={publish} loading={busy} disabled={!origin || !dest} icon="paper-plane" />}>
      <AddressField label="Départ" value={origin} onChange={setOrigin} allowCurrentLocation />
      <AddressField label="Arrivée" value={dest} onChange={setDest} />

      <Card>
        <T variant="label">Départ le</T>
        <Row gap={8} style={{ marginTop: 10 }}>
          <Button title={date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
            variant="secondary" icon="calendar" onPress={() => setPicker('date')} style={{ flex: 1 }} />
          <Button title={date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            variant="secondary" icon="time" onPress={() => setPicker('time')} style={{ flex: 1 }} />
        </Row>
        {picker && (
          <DateTimePicker
            value={date}
            mode={picker}
            minimumDate={new Date(Date.now() + 30 * 60_000)}
            maximumDate={new Date(Date.now() + 14 * 24 * 3_600_000)}
            minuteInterval={5}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            locale="fr-FR"
            onChange={(e, d) => {
              if (Platform.OS === 'android') setPicker(null);
              if (e.type === 'set' && d) setDate(d);
            }}
          />
        )}
        {picker && Platform.OS === 'ios' && <Button title="OK" variant="ghost" onPress={() => setPicker(null)} />}
        <T variant="small" style={{ marginTop: 8 }}>{dateTime(date.toISOString())}</T>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h2">Places proposées</T>
          <Row gap={16}>
            <Pressable onPress={() => setSeats(Math.max(1, seats - 1))} hitSlop={10}><T variant="title" color={c.primary}>−</T></Pressable>
            <T variant="title">{seats}</T>
            <Pressable onPress={() => setSeats(Math.min(7, seats + 1))} hitSlop={10}><T variant="title" color={c.primary}>+</T></Pressable>
          </Row>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <T style={{ flex: 1 }}>Chaque jour à la même heure</T>
          <Switch value={daily} onValueChange={setDaily} trackColor={{ true: c.primary, false: c.border }} />
        </Row>
      </Card>
      <T variant="small">
        Le prix est calculé automatiquement selon la distance et votre véhicule : il couvre vos frais, sans bénéfice.
      </T>
    </Screen>
  );
}
