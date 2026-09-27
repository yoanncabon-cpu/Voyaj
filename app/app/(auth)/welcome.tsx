import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Spacer, T } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

const POINTS = [
  { icon: 'flash' as const, text: 'Une voiture en quelques minutes, au prix du partage de frais' },
  { icon: 'calendar' as const, text: 'Des trajets programmés entre villes' },
  { icon: 'shield-checkmark' as const, text: 'Conducteurs vérifiés, paiement sécurisé' },
];

export default function Welcome() {
  const c = useColors();
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.primary }}>
      <View style={{ flex: 1, padding: space.lg, justifyContent: 'space-between' }}>
        <View style={{ marginTop: space.xl * 2 }}>
          <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="car-sport" size={40} color="#fff" />
          </View>
          <Spacer h={space.lg} />
          <T variant="big" color="#fff">Voyaj</T>
          <T variant="h2" color="rgba(255,255,255,0.85)" style={{ marginTop: 6 }}>Covoiturage et autostop connecté</T>
          <Spacer h={space.xl} />
          {POINTS.map((p) => (
            <View key={p.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Ionicons name={p.icon} size={22} color="#fff" />
              <T color="#fff" style={{ flex: 1 }}>{p.text}</T>
            </View>
          ))}
        </View>
        <View>
          {!isSupabaseConfigured && (
            <T variant="small" color="#FDE68A" center style={{ marginBottom: 12 }}>
              Serveur non configuré (EXPO_PUBLIC_SUPABASE_URL)
            </T>
          )}
          <Button title="Créer un compte" variant="secondary" onPress={() => router.push('/(auth)/signup')} />
          <Spacer h={space.sm} />
          <Button title="J'ai déjà un compte" variant="light"
            onPress={() => router.push('/(auth)/login')} />
        </View>
      </View>
    </SafeAreaView>
  );
}
