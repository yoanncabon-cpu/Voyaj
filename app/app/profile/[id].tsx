import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, Badge, Button, Card, Loading, Row, Screen, Stars, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { PublicProfile } from '@/lib/types';

/** Profil public d'un autre membre. */
export default function PublicProfileScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<PublicProfile | null>(null);

  useEffect(() => {
    if (id) supabase.from('public_profiles').select('*').eq('id', id).maybeSingle().then(({ data }) => setP(data as PublicProfile));
  }, [id]);

  if (!p) return <Loading />;

  return (
    <Screen title="Profil">
      <View style={{ alignItems: 'center', gap: 8, marginVertical: 16 }}>
        <Avatar name={p.name} url={p.avatar_url} size={96} />
        <T variant="title">{p.name}</T>
        <Row gap={8}>
          <Stars value={p.rating} />
          <T variant="small">({p.ratings_count} avis)</T>
        </Row>
        <Row gap={8}>
          {p.is_verified && <Badge text="Identité vérifiée" tone="success" />}
          {p.is_driver && <Badge text="Conducteur" tone="primary" />}
        </Row>
      </View>
      {!!p.bio && <Card><T>{p.bio}</T></Card>}
      <Card>
        <Row style={{ justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center' }}><T variant="title">{p.rides_count}</T><T variant="small">trajets</T></View>
          <View style={{ alignItems: 'center' }}><T variant="title">{new Date(p.created_at).getFullYear()}</T><T variant="small">membre depuis</T></View>
        </Row>
      </Card>
      {p.id !== userId && (
        <Button title="Envoyer un message" icon="chatbubble" onPress={async () => {
          const { data } = await supabase.rpc('get_or_create_conversation', { other: p.id });
          if (data) router.push(`/messages/${data}`);
        }} />
      )}
    </Screen>
  );
}
