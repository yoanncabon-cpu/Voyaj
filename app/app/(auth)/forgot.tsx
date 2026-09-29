import { useState } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, Field, Screen, Spacer, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

export default function ForgotPassword() {
  const { resetPassword, confirmPasswordReset } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    if (!email.includes('@')) return setError('Adresse e-mail invalide');
    setBusy(true);
    const err = await resetPassword(email);
    setBusy(false);
    if (err) return setError(err);
    setError(null);
    setStep('code');
  };

  const submit = async () => {
    if (code.trim().length < 6) return setError('Saisissez le code reçu par e-mail');
    if (password.length < 8) return setError('Mot de passe : 8 caractères minimum');
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas');
    setBusy(true);
    const err = await confirmPasswordReset(email, code, password);
    setBusy(false);
    if (err) return setError(err);
    Alert.alert('Mot de passe modifié', 'Vous êtes connecté avec votre nouveau mot de passe.');
  };

  if (step === 'email') {
    return (
      <Screen title="Mot de passe oublié">
        <T variant="title">Réinitialiser</T>
        <T variant="small" style={{ marginTop: 6 }}>Nous vous envoyons un code par e-mail pour choisir un nouveau mot de passe.</T>
        <Spacer />
        <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
          autoComplete="email" textContentType="emailAddress" error={error} />
        <Button title="Recevoir le code" onPress={sendCode} loading={busy} disabled={!email} />
      </Screen>
    );
  }

  return (
    <Screen title="Nouveau mot de passe">
      <T variant="title">Vérifiez vos e-mails</T>
      <T variant="small" style={{ marginTop: 6 }}>Code envoyé à {email.trim()}. Pensez à regarder dans les spams.</T>
      <Spacer />
      <Field label="Code reçu par e-mail" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
        keyboardType="number-pad" maxLength={10} autoComplete="one-time-code" textContentType="oneTimeCode" />
      <Field label="Nouveau mot de passe (8 caractères min.)" value={password} onChangeText={setPassword} secureTextEntry
        autoComplete="new-password" textContentType="newPassword" />
      <Field label="Confirmer le mot de passe" value={confirm} onChangeText={setConfirm} secureTextEntry
        autoComplete="new-password" textContentType="newPassword" error={error} />
      <Button title="Changer mon mot de passe" onPress={submit} loading={busy} disabled={!code || !password || !confirm} />
      <Spacer h={8} />
      <Button title="Renvoyer un code" variant="ghost" onPress={sendCode} disabled={busy} />
    </Screen>
  );
}
