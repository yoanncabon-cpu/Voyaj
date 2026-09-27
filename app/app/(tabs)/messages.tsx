import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Empty, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { timeAgo } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';
import type { Conversation, PublicProfile } from '@/lib/types';

interface Item extends Conversation {
  other?: PublicProfile;
}

export default function Messages() {
  const c = useColors();
  const router = useRouter();
  const { userId } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('conversations').select('*')
      .not('last_message_at', 'is', null).order('last_message_at', { ascending: false }).limit(100);
    const convs = (data as Conversation[]) ?? [];
    const others = convs.map((cv) => (cv.user_a === userId ? cv.user_b : cv.user_a));
    const { data: profiles } = others.length
      ? await supabase.from('public_profiles').select('*').in('id', others)
      : { data: [] };
    setItems(convs.map((cv) => ({
      ...cv,
      other: (profiles as PublicProfile[]).find((p) => p.id === (cv.user_a === userId ? cv.user_b : cv.user_a)),
    })));
    setLoaded(true);
  }, [userId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  useEffect(() => {
    if (!userId) return;
    const ch = supabase.channel(`convs-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <T variant="title" style={{ padding: space.md }}>Messages</T>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={loaded ? <Empty icon="chatbubbles-outline" title="Aucune conversation" text="Écrivez à un conducteur depuis un trajet, ou à votre chauffeur pendant une course." /> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/messages/${item.id}`)}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: space.md, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Avatar name={item.other?.name} url={item.other?.avatar_url} />
            <View style={{ flex: 1 }}>
              <T variant="h2" numberOfLines={1}>{item.other?.name ?? 'Membre Voyaj'}</T>
              <T variant="small" numberOfLines={1}>{item.last_message}</T>
            </View>
            {item.last_message_at && <T variant="small">{timeAgo(item.last_message_at)}</T>}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
