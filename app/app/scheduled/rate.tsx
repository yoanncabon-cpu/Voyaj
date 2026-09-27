import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, Field, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';
import type { PublicProfile } from '@/lib/types';

/** Note d'un participant après un trajet programmé. */
export default function RateScheduled() {
  const c = useColors();
  const router = useRouter();
  const { userId } = useAuth();
  const { id, user } = useLocalSearchParams<{ id: string; user: string }>();
  const [person, setPerson] = useState<PublicProfile | null>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) supabase.from('public_profiles').select('*').eq('id', user).maybeSingle().then(({ data }) => setPerson(data as PublicProfile));
  }, [user]);

  const submit = async () => {
    setBusy(true);
    try {
      // Le chauffeur précise quel passager il note ; le passager note le chauffeur.
      await api.rate(id!, 'scheduled', score, comment || undefined, user !== userId ? user : undefined);
      Alert.alert('Merci !', 'Votre note a été enregistrée.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Noter" footer={<Button title="Envoyer" onPress={submit} loading={busy} disabled={score === 0} />}>
      <View style={{ alignItems: 'center', marginVertical: 16, gap: 8 }}>
        <Avatar name={person?.name} url={person?.avatar_url} size={72} />
        <T variant="h2">{person?.name ?? '…'}</T>
      </View>
      <Row style={{ justifyContent: 'center', marginBottom: 20 }} gap={6}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setScore(n)} hitSlop={6}>
            <Ionicons name={n <= score ? 'star' : 'star-outline'} size={40} color={c.gold} />
          </Pressable>
        ))}
      </Row>
      <Field label="Commentaire (facultatif)" value={comment} onChangeText={setComment} multiline maxLength={500} />
    </Screen>
  );
}
