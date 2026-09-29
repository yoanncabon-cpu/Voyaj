import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Field, Screen, Spacer, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const { signIn, resendSignupCode } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const err = await signIn(email, password);
    setBusy(false);
    setError(err);
    if (err?.startsWith('Confirmez')) {
      await resendSignupCode(email);
      router.push({ pathname: '/(auth)/verify', params: { email: email.trim() } });
    }
  };

  const forgot = () => router.push({ pathname: '/(auth)/forgot', params: { email: email.trim() } });

  return (
    <Screen title="Connexion">
      <T variant="title">Bon retour 👋</T>
      <Spacer />
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
        autoComplete="email" textContentType="emailAddress" />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password"
        textContentType="password" error={error} />
      <Button title="Se connecter" onPress={submit} loading={busy} disabled={!email || !password} />
      <Spacer h={8} />
      <Button title="Mot de passe oublié" variant="ghost" onPress={forgot} />
      <Button title="Pas encore de compte ? S'inscrire" variant="ghost" onPress={() => router.replace('/(auth)/signup')} />
    </Screen>
  );
}
