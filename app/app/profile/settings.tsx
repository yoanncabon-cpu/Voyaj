import { Alert, Linking } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ListItem, Screen, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

export default function Settings() {
  const { signOut, session } = useAuth();
  const router = useRouter();

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
