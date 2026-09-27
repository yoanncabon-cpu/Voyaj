import { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Row, Screen, Spacer, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

type Side = 'id_front' | 'id_back' | 'license';
const SIDES: { id: Side; label: string }[] = [
  { id: 'id_front', label: 'Pièce d\'identité — recto' },
  { id: 'id_back', label: 'Pièce d\'identité — verso' },
  { id: 'license', label: 'Permis de conduire (recto)' },
];

export default function Verification() {
  const c = useColors();
  const { profile, userId } = useAuth();
  const [photos, setPhotos] = useState<Partial<Record<Side, string>>>({});
  const [busy, setBusy] = useState(false);

  if (profile?.is_verified) {
    return (
      <Screen title="Vérification">
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <Ionicons name="shield-checkmark" size={80} color={c.success} />
          <T variant="title" center>Identité vérifiée</T>
          <T variant="small" center style={{ marginTop: 8 }}>Vous pouvez conduire et publier des trajets.</T>
        </View>
      </Screen>
    );
  }
  if (profile?.verification_status === 'pending') {
    return (
      <Screen title="Vérification">
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <Ionicons name="hourglass" size={80} color={c.warning} />
          <T variant="title" center>Documents en cours d&apos;examen</T>
          <T variant="small" center style={{ marginTop: 8 }}>Réponse sous 48 h ouvrées. Vous serez notifié·e.</T>
        </View>
      </Screen>
    );
  }

  const shoot = async (side: Side) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const res = perm.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!res.canceled) setPhotos((p) => ({ ...p, [side]: res.assets[0].uri }));
  };

  const submit = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      for (const side of SIDES) {
        const uri = photos[side.id];
        if (!uri) continue;
        const body = await (await fetch(uri)).arrayBuffer();
        const { error } = await supabase.storage.from('identity')
          .upload(`${userId}/${side.id}.jpg`, body, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
      }
      await api.submitVerification();
      Alert.alert('Documents envoyés', 'Nous revenons vers vous sous 48 h ouvrées.');
    } catch (e) {
      Alert.alert('Envoi impossible', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const complete = SIDES.every((s) => photos[s.id]);
  return (
    <Screen title="Vérification d'identité"
      footer={<Button title="Envoyer mes documents" onPress={submit} loading={busy} disabled={!complete} icon="cloud-upload" />}>
      {profile?.verification_status === 'rejected' && (
        <Card style={{ backgroundColor: c.dangerSoft }}>
          <T color={c.danger}>Votre précédente demande a été refusée (document illisible ou non conforme). Merci de recommencer.</T>
        </Card>
      )}
      <T variant="small">
        Obligatoire pour conduire. Vos documents sont stockés de façon privée et visibles
        uniquement par l&apos;équipe Voyaj.
      </T>
      <Spacer />
      {SIDES.map((s) => (
        <Card key={s.id} onPress={() => shoot(s.id)}>
          <Row gap={12}>
            {photos[s.id] ? (
              <Image source={{ uri: photos[s.id] }} style={{ width: 64, height: 44, borderRadius: 6 }} />
            ) : <Ionicons name="camera" size={28} color={c.primary} />}
            <T style={{ flex: 1 }}>{s.label}</T>
            {photos[s.id] && <Ionicons name="checkmark-circle" size={22} color={c.success} />}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
