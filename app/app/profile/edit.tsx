import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Button, Field, Screen, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useColors } from '@/lib/theme';

export default function EditProfile() {
  const c = useColors();
  const router = useRouter();
  const { profile, userId, updateProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled || !userId) return;
    setUploading(true);
    try {
      const asset = res.assets[0];
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const body = await (await fetch(asset.uri)).arrayBuffer();
      const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const err = await updateProfile({ avatar_url: data.publicUrl });
      if (err) throw new Error(err);
    } catch (e) {
      Alert.alert('Photo non envoyée', (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setBusy(true);
    const err = await updateProfile({ name: name.trim(), bio: bio.trim() || null });
    setBusy(false);
    if (err) Alert.alert('Erreur', err);
    else router.back();
  };

  return (
    <Screen title="Mon profil" footer={<Button title="Enregistrer" onPress={save} loading={busy} disabled={name.trim().length < 2} />}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Pressable onPress={pickAvatar} disabled={uploading}>
          <Avatar name={profile?.name} url={profile?.avatar_url} size={96} />
        </Pressable>
        <T variant="small" color={c.primary} style={{ marginTop: 8 }}>{uploading ? 'Envoi…' : 'Changer la photo'}</T>
      </View>
      <Field label="Prénom et nom" value={name} onChangeText={setName} />
      <Field label="Présentation (facultatif)" value={bio} onChangeText={setBio} multiline maxLength={300}
        placeholder="Musique, discussion, animaux acceptés…" />
      <T variant="small">Téléphone : {profile?.phone ?? '—'} (non visible par les autres membres)</T>
    </Screen>
  );
}
