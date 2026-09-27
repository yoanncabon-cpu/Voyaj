import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Field, Row, Screen, Spacer, T } from '@/components/ui';
import { api } from '@/lib/api';
import { useColors } from '@/lib/theme';

const REASONS = [
  { id: 'wrong_price', label: 'Prix incorrect' },
  { id: 'no_show_driver', label: 'Le chauffeur n\'est pas venu' },
  { id: 'no_show_passenger', label: 'Le passager n\'est pas venu' },
  { id: 'safety', label: 'Problème de sécurité' },
  { id: 'vehicle', label: 'Véhicule non conforme' },
  { id: 'other', label: 'Autre' },
];

export default function Dispute() {
  const c = useColors();
  const router = useRouter();
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  const [reason, setReason] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason || !id) return;
    setBusy(true);
    try {
      await api.dispute(id, kind === 'scheduled' ? 'scheduled' : 'instant', reason, text.trim());
      Alert.alert('Signalement envoyé', 'Notre équipe revient vers vous sous 48 h. Le paiement au chauffeur est suspendu en attendant.',
        [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Signaler un problème"
      footer={<Button title="Envoyer" onPress={submit} loading={busy} disabled={!reason || text.trim().length < 10} />}>
      <T variant="small">En cas de danger immédiat, appelez le 17 ou le 112.</T>
      <Spacer />
      {REASONS.map((r) => (
        <Pressable key={r.id} onPress={() => setReason(r.id)} style={{ paddingVertical: 12 }}>
          <Row gap={12}>
            <Ionicons name={reason === r.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={c.primary} />
            <T>{r.label}</T>
          </Row>
        </Pressable>
      ))}
      <Spacer />
      <Field label="Que s'est-il passé ? (10 caractères min.)" value={text} onChangeText={setText} multiline maxLength={1000} />
    </Screen>
  );
}
