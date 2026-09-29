import { Alert, Linking, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ListItem, Screen, Segmented, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useThemePreference } from '@/lib/theme';

export default function Settings() {
  const { signOut, session } = useAuth();
  const router = useRouter();
  const { preference, setPreference } = useThemePreference();

  const deleteAccount = () => Alert.alert(
    'Supprimer mon compte',
    'Vos données personnelles seront effacées définitivement. Cette action est irréversible.',
    [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await api.deleteAccount();
            await signOut();
          } catch (e) {
            Alert.alert('Suppression impossible', (e as Error).message);
          }
        },
      },
    ],
  );

  return (
    <Screen title="Paramètres">
      <T variant="label">Apparence</T>
      <View style={{ marginTop: 10, marginBottom: 24 }}>
        <Segmented value={preference} onChange={setPreference} options={[
          { value: 'system', label: 'Auto', icon: 'phone-portrait-outline' },
          { value: 'light', label: 'Clair', icon: 'sunny' },
          { value: 'dark', label: 'Sombre', icon: 'moon' },
        ]} />
        <T variant="small" style={{ marginTop: 8 }}>« Auto » suit le réglage de votre téléphone.</T>
      </View>
      <T variant="label">Aide</T>
      <ListItem icon="mail" title="Contacter le support" subtitle="support@voyajapp.com" onPress={() => Linking.openURL('mailto:support@voyajapp.com')} />
      <ListItem icon="document-text" title="Conditions générales" onPress={() => Linking.openURL('https://voyajapp.com/cgu')} />
      <ListItem icon="lock-closed" title="Confidentialité" onPress={() => Linking.openURL('https://voyajapp.com/confidentialite')} />
      <ListItem icon="notifications" title="Notifications" subtitle="Réglages du téléphone" onPress={() => Linking.openSettings()} />
      <T variant="label" style={{ marginTop: 24 }}>Compte</T>
      <ListItem icon="mail-outline" title="E-mail du compte" subtitle={session?.user.email ?? undefined} />
      <ListItem icon="key" title="Changer mon mot de passe" onPress={() => router.push('/profile/password')} />
      <ListItem icon="log-out" title="Se déconnecter" onPress={signOut} />
      <ListItem icon="trash" title="Supprimer mon compte" danger onPress={deleteAccount} />
      <T variant="small" center style={{ marginTop: 24 }}>Voyaj {Constants.expoConfig?.version}</T>
    </Screen>
  );
}
