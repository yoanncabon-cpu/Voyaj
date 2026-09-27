import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, Spacer, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/lib/theme';

const RULES = [
  'Voyaj met en relation des particuliers qui partagent les frais d\'un trajet. Le conducteur ne réalise aucun bénéfice.',
  'Le prix est calculé automatiquement (carburant + usure, divisés entre les occupants) : il ne peut pas être négocié.',
  'Le paiement se fait uniquement dans l\'application. Aucun paiement en espèces.',
  'Le passager donne son code à 4 chiffres au conducteur au moment de monter.',
  'Respect, ponctualité et sécurité : tout comportement dangereux entraîne la suspension du compte.',
];

export default function Terms() {
  const c = useColors();
  const { updateProfile, signOut } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setBusy(true);
    const err = await updateProfile({ terms_accepted_at: new Date().toISOString() });
    setBusy(false);
    setError(err);
  };

  return (
    <Screen title="Conditions d'utilisation" back={false}
      footer={<Button title="Continuer" onPress={accept} loading={busy} disabled={!accepted} />}>
      <T variant="title">Avant de commencer</T>
      <Spacer />
      <Card>
        {RULES.map((r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <Ionicons name="checkmark-circle" size={20} color={c.primary} />
            <T style={{ flex: 1 }}>{r}</T>
          </View>
        ))}
      </Card>
      <Pressable onPress={() => Linking.openURL('https://voyajapp.com/cgu')}>
        <T color={c.primary}>Lire les conditions générales complètes</T>
      </Pressable>
      <Spacer h={6} />
      <Pressable onPress={() => Linking.openURL('https://voyajapp.com/confidentialite')}>
        <T color={c.primary}>Politique de confidentialité</T>
      </Pressable>
      <Spacer />
      <Pressable onPress={() => setAccepted(!accepted)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
        accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={26} color={c.primary} />
        <T style={{ flex: 1 }}>J&apos;ai lu et j&apos;accepte les conditions générales et la politique de confidentialité.</T>
      </Pressable>
      {!!error && <T color={c.danger} style={{ marginTop: 12 }}>{error}</T>}
      <Spacer h={24} />
      <Button title="Se déconnecter" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
