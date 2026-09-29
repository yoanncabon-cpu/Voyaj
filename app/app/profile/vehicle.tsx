import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, Field, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { radius, useColors } from '@/lib/theme';
import type { Vehicle } from '@/lib/types';

const TYPES: { id: Vehicle['vehicle_type']; label: string }[] = [
  { id: 'citadine', label: 'Citadine' },
  { id: 'berline', label: 'Berline' },
  { id: 'break', label: 'Break' },
  { id: 'suv', label: 'SUV' },
  { id: 'utilitaire', label: 'Utilitaire' },
];

export default function VehicleScreen() {
  const c = useColors();
  const router = useRouter();
  const { userId } = useAuth();
  const [locked, setLocked] = useState(false);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [plate, setPlate] = useState('');
  const [color, setColor] = useState('');
  const [type, setType] = useState<Vehicle['vehicle_type']>('berline');
  const [seats, setSeats] = useState(3);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('vehicles').select('*').eq('owner_id', userId).maybeSingle().then(({ data }) => {
      const v = data as Vehicle | null;
      if (!v) return;
      setMake(v.make); setModel(v.model); setPlate(v.plate); setColor(v.color ?? '');
      setType(v.vehicle_type); setSeats(v.seats); setLocked(v.locked);
    });
  }, [userId]);

  const save = async () => {
    setBusy(true);
    try {
      await api.saveVehicle({ make, model, plate, color: color || undefined, vehicleType: type, seats });
      Alert.alert('Véhicule enregistré', undefined, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Mon véhicule"
      footer={!locked ? <Button title="Enregistrer" onPress={save} loading={busy} disabled={!make || !model || plate.length < 5} /> : undefined}>
      {locked && <View style={{ marginBottom: 16 }}><Badge text="Validé par Voyaj — modification via le support" tone="success" /></View>}
      <Field label="Marque" value={make} onChangeText={setMake} editable={!locked} placeholder="Peugeot" />
      <Field label="Modèle" value={model} onChangeText={setModel} editable={!locked} placeholder="308" />
      <Field label="Plaque d'immatriculation" value={plate} onChangeText={(t) => setPlate(t.toUpperCase())} editable={!locked}
        autoCapitalize="characters" placeholder="AB-123-CD" />
      <Field label="Couleur (facultatif)" value={color} onChangeText={setColor} editable={!locked} placeholder="Gris" />
      <Card>
        <T variant="label">Type (sert au calcul du prix)</T>
        <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 10 }}>
          {TYPES.map((t) => (
            <Pressable key={t.id} disabled={locked} onPress={() => setType(t.id)}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: type === t.id ? c.primary : c.surfaceAlt }}>
              <T color={type === t.id ? c.onPrimary : c.text} style={{ fontWeight: '600' }}>{t.label}</T>
            </Pressable>
          ))}
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 18 }}>
          <T>Places passagers</T>
          <Row gap={16}>
            <Pressable disabled={locked} onPress={() => setSeats(Math.max(1, seats - 1))} hitSlop={10}><T variant="title" color={c.primary}>−</T></Pressable>
            <T variant="title">{seats}</T>
            <Pressable disabled={locked} onPress={() => setSeats(Math.min(7, seats + 1))} hitSlop={10}><T variant="title" color={c.primary}>+</T></Pressable>
          </Row>
        </Row>
      </Card>
    </Screen>
  );
}
