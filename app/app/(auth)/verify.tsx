import { useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthHeader, Button, Field, Screen, Spacer } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

export default function VerifyEmail() {
  const { verifySignup, resendSignupCode } = useAuth();
  const router = useRouter();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (code.trim().length < 6) return setError('Saisissez le code reçu par e-mail');
    setBusy(true);
    const err = await verifySignup(email, code);
    setBusy(false);
    if (err) setError(err);
  };

  const resend = async () => {
    const err = await resendSignupCode(email);
    Alert.alert(err ? 'Erreur' : 'Code renvoyé', err ?? `Un nouveau code a été envoyé à ${email}.`);
  };

  return (
    <Screen title="">
      <AuthHeader title="Confirmez votre e-mail" subtitle={`Saisissez le code envoyé à ${email}. Pensez à regarder dans les spams.`} />
      <Field label="Code reçu par e-mail" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
        keyboardType="number-pad" maxLength={10} autoComplete="one-time-code" textContentType="oneTimeCode" error={error} />
      <Button title="Confirmer" onPress={submit} loading={busy} disabled={!code} />
      <Spacer h={8} />
      <Button title="Renvoyer un code" variant="ghost" onPress={resend} disabled={busy} />
      <Button title="Retour à la connexion" variant="ghost" onPress={() => router.replace('/(auth)/login')} />
    </Screen>
  );
}
