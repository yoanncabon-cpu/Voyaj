import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Card, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

/** Le passager publie une demande quand aucun trajet ne correspond. */
export default function RideRequestPost() {
  const router = useRouter();
  const { userId } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(new Date(Date.now() + 24 * 3_600_000));
  const [show, setShow] = useState(Platform.OS === 'ios');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const { error } = await supabase.from('ride_requests').insert({
      passenger_id: userId,
      origin_address: from.trim(),
      dest_address: to.trim(),
      requested_date: date.toISOString().slice(0, 10),
    });
    setBusy(false);
    if (error) return Alert.alert('Erreur', error.message);
    Alert.alert('Demande publiée', 'Les conducteurs qui font ce trajet pourront vous contacter.', [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <Screen title="Publier une demande"
      footer={<Button title="Publier ma demande" onPress={submit} loading={busy} disabled={from.trim().length < 2 || to.trim().length < 2} />}>
      <T variant="small" style={{ marginBottom: 16 }}>Aucun trajet ne vous convient ? Indiquez le vôtre.</T>
      <Field label="Ville de départ" value={from} onChangeText={setFrom} />
      <Field label="Ville d'arrivée" value={to} onChangeText={setTo} />
      <Card>
        <T variant="label">Date souhaitée</T>
        {Platform.OS === 'android' && (
          <Button title={date.toLocaleDateString('fr-FR')} variant="secondary" icon="calendar" onPress={() => setShow(true)} style={{ marginTop: 10 }} />
        )}
        {show && (
          <DateTimePicker value={date} mode="date" minimumDate={new Date()} maximumDate={new Date(Date.now() + 30 * 24 * 3_600_000)}
            locale="fr-FR" onChange={(e, d) => {
              if (Platform.OS === 'android') setShow(false);
              if (e.type === 'set' && d) setDate(d);
            }} />
        )}
      </Card>
    </Screen>
  );
}
