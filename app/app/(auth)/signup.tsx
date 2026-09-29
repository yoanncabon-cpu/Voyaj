import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthHeader, Button, Field, Screen, Spacer } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

const PHONE_FR = /^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/;

/** 06 12 34 56 78 → +33612345678 (un seul format en base, pour l'unicité). */
function normalizePhone(p: string): string {
  const digits = p.replace(/[^\d+]/g, '');
  return digits.startsWith('+33') ? digits : '+33' + digits.replace(/^0/, '');
}

export default function Signup() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) return setError('Indiquez votre prénom et nom');
    if (!PHONE_FR.test(phone.trim())) return setError('Numéro de téléphone français invalide');
    if (password.length < 8) return setError('Mot de passe : 8 caractères minimum');
    setBusy(true);
    setError(null);
    const res = await signUp(email, password, name, normalizePhone(phone));
    setBusy(false);
    if (res.error) return setError(res.error);
    if (res.needsConfirmation) {
      router.replace({ pathname: '/(auth)/verify', params: { email: email.trim() } });
    }
  };

  return (
    <Screen title="">
      <AuthHeader title="Créer votre compte" subtitle="Vos coordonnées ne sont jamais montrées aux autres membres." />
      <Field label="Prénom et nom" value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
        autoComplete="email" textContentType="emailAddress" />
      <Field label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="06 12 34 56 78"
        autoComplete="tel" textContentType="telephoneNumber" />
      <Field label="Mot de passe (8 caractères min.)" value={password} onChangeText={setPassword} secureTextEntry
        autoComplete="new-password" textContentType="newPassword" error={error} />
      <Button title="Créer mon compte" onPress={submit} loading={busy} disabled={!email || !password || !name} />
      <Spacer h={8} />
      <Button title="J'ai déjà un compte" variant="ghost" onPress={() => router.replace('/(auth)/login')} />
    </Screen>
  );
}
