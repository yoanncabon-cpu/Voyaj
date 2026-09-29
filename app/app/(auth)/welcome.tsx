import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Button, Spacer, T } from '@/components/ui';
import { isSupabaseConfigured } from '@/lib/supabase';
import { brand, space } from '@/lib/theme';

const POINTS = [
  { icon: 'flash' as const, text: 'Une voiture en quelques minutes, au prix du partage de frais' },
  { icon: 'calendar' as const, text: 'Des trajets programmés entre villes' },
  { icon: 'shield-checkmark' as const, text: 'Conducteurs vérifiés, paiement sécurisé' },
];

export default function Welcome() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: brand.navy }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, padding: space.lg, justifyContent: 'space-between' }}>
        <View style={{ marginTop: space.xl * 2 }}>
          <Image source={require('@/assets/icon.png')} style={{ width: 76, height: 76, borderRadius: 20 }} accessibilityLabel="Logo Voyaj" />
          <Spacer h={space.lg} />
          <T variant="big" color={brand.cream}>Voyaj</T>
          <T variant="h2" color={brand.cream} style={{ marginTop: 6, opacity: 0.85 }}>Covoiturage et autostop connecté</T>
          <Spacer h={space.xl} />
          {POINTS.map((p) => (
            <View key={p.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Ionicons name={p.icon} size={22} color={brand.green} />
              <T color={brand.cream} style={{ flex: 1 }}>{p.text}</T>
            </View>
          ))}
        </View>
        <View>
          {!isSupabaseConfigured && (
            <T variant="small" color="#FDE68A" center style={{ marginBottom: 12 }}>
              Serveur non configuré (EXPO_PUBLIC_SUPABASE_URL)
            </T>
          )}
          <Button title="Créer un compte" onPress={() => router.push('/(auth)/signup')} />
          <Spacer h={space.sm} />
          <Button title="J'ai déjà un compte" variant="light"
            onPress={() => router.push('/(auth)/login')} />
        </View>
      </View>
    </SafeAreaView>
  );
}
