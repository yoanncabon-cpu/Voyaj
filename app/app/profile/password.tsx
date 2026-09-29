import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Field, Screen, Spacer, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

export default function ChangePassword() {
  const { changePassword } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (password.length < 8) return setError('Mot de passe : 8 caractères minimum');
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas');
    setBusy(true);
    const err = await changePassword(password);
    setBusy(false);
    if (err) return setError(err);
    Alert.alert('Mot de passe modifié', 'Utilisez-le lors de votre prochaine connexion.');
    router.back();
  };

  return (
    <Screen title="Mot de passe">
      <T variant="small">Choisissez un nouveau mot de passe d’au moins 8 caractères.</T>
      <Spacer />
      <Field label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry
        autoComplete="new-password" textContentType="newPassword" />
      <Field label="Confirmer le mot de passe" value={confirm} onChangeText={setConfirm} secureTextEntry
        autoComplete="new-password" textContentType="newPassword" error={error} />
      <Button title="Enregistrer" onPress={submit} loading={busy} disabled={!password || !confirm} />
    </Screen>
  );
}
