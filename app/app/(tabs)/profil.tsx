import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Badge, Card, ListItem, Row, Stars, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { space, useColors } from '@/lib/theme';

export default function Profil() {
  const c = useColors();
  const router = useRouter();
  const { profile } = useAuth();
  if (!profile) return null;

  const verification = {
    none: { text: 'Non vérifié', tone: 'neutral' as const },
    pending: { text: 'Vérification en cours', tone: 'warning' as const },
    verified: { text: 'Identité vérifiée', tone: 'success' as const },
    rejected: { text: 'Vérification refusée', tone: 'danger' as const },
  }[profile.verification_status];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 60 }}>
        <Card onPress={() => router.push('/profile/edit')}>
          <Row gap={14}>
            <Avatar name={profile.name} url={profile.avatar_url} size={64} />
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="h2">{profile.name ?? 'Mon profil'}</T>
              <Stars value={profile.rating} />
              <Badge text={verification.text} tone={verification.tone} />
            </View>
          </Row>
        </Card>

        <Row gap={space.sm}>
          <Card style={{ flex: 1, alignItems: 'center' }} onPress={() => router.push('/profile/points')}>
            <T variant="title" color={c.gold}>{profile.points_balance}</T>
            <T variant="small">points</T>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center' }} onPress={() => router.push('/profile/history')}>
            <T variant="title">{profile.rides_count}</T>
            <T variant="small">trajets</T>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center' }}>
            <T variant="title">{profile.ratings_count}</T>
            <T variant="small">avis</T>
          </Card>
        </Row>

        <T variant="label" style={{ marginTop: space.md }}>Conduire</T>
        <ListItem icon="id-card" title="Vérification d'identité" subtitle={verification.text} onPress={() => router.push('/profile/verification')} />
        <ListItem icon="car" title="Mon véhicule" onPress={() => router.push('/profile/vehicle')} />
        <ListItem icon="wallet" title="Paiements et gains" subtitle={profile.stripe_payouts_enabled ? 'Virements actifs' : undefined}
          onPress={() => router.push('/profile/payment')} />

        <T variant="label" style={{ marginTop: space.lg }}>Mon compte</T>
        <ListItem icon="time" title="Historique des courses" onPress={() => router.push('/profile/history')} />
        <ListItem icon="gift" title="Points et récompenses" onPress={() => router.push('/profile/points')} />
        <ListItem icon="home" title="Je suis bien rentré" onPress={() => router.push('/safe-return')} />
        <ListItem icon="settings" title="Paramètres" onPress={() => router.push('/profile/settings')} />
      </ScrollView>
    </SafeAreaView>
  );
}
