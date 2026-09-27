import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Row, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { radius, space, useColors } from '@/lib/theme';
import type { Conversation, Message, PublicProfile } from '@/lib/types';

export default function Chat() {
  const c = useColors();
  const router = useRouter();
  const { userId } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<PublicProfile | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<Message>>(null);

  const markRead = useCallback(async () => {
    if (!id || !userId) return;
    await supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('conversation_id', id).neq('sender_id', userId).is('read_at', null);
  }, [id, userId]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: conv } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
      const cv = conv as Conversation | null;
      if (cv && userId) {
        const otherId = cv.user_a === userId ? cv.user_b : cv.user_a;
        const { data: p } = await supabase.from('public_profiles').select('*').eq('id', otherId).maybeSingle();
        setOther(p as PublicProfile);
      }
      const { data } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at').limit(300);
      setMessages((data as Message[]) ?? []);
      markRead();
    })();
    const ch = supabase.channel(`chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, (p) => {
        const m = p.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        markRead();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, userId, markRead]);

  const send = async () => {
    const content = text.trim();
    if (!content || !id) return;
    setSending(true);
    const { data, error } = await supabase.from('messages').insert({ conversation_id: id, content }).select().single();
    setSending(false);
    if (error) return Alert.alert('Message non envoyé', 'Vérifiez votre connexion.');
    setText('');
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]));
  };

  const block = () => {
    if (!other) return;
    Alert.alert(`Bloquer ${other.name ?? 'ce membre'} ?`, 'Vous ne recevrez plus ses messages.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Bloquer', style: 'destructive', onPress: async () => {
          await supabase.from('user_blocks').insert({ blocked_id: other.id });
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <Row style={{ padding: space.md, borderBottomWidth: 1, borderBottomColor: c.border }} gap={12}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Ionicons name="chevron-back" size={26} color={c.text} /></Pressable>
        <Pressable style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }} onPress={() => other && router.push(`/profile/${other.id}`)}>
          <Avatar name={other?.name} url={other?.avatar_url} size={36} />
          <T variant="h2" numberOfLines={1}>{other?.name ?? '…'}</T>
        </Pressable>
        <Pressable onPress={block} hitSlop={12} accessibilityLabel="Bloquer"><Ionicons name="ban" size={22} color={c.textMuted} /></Pressable>
      </Row>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.md, gap: 6 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.sender_id === userId;
            return (
              <View style={{
                alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 9,
                borderRadius: radius.md, backgroundColor: mine ? c.primary : c.surface,
                borderBottomRightRadius: mine ? 4 : radius.md, borderBottomLeftRadius: mine ? radius.md : 4,
              }}>
                <T color={mine ? '#fff' : c.text}>{item.content}</T>
                <T variant="small" color={mine ? 'rgba(255,255,255,0.7)' : c.textMuted} style={{ fontSize: 11, marginTop: 2, textAlign: 'right' }}>
                  {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </T>
              </View>
            );
          }}
        />
        <Row style={{ padding: space.sm, borderTopWidth: 1, borderTopColor: c.border }} gap={8}>
          <TextInput value={text} onChangeText={setText} placeholder="Message" placeholderTextColor={c.textMuted} multiline maxLength={2000}
            style={{ flex: 1, backgroundColor: c.surface, color: c.text, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120 }} />
          <Pressable onPress={send} disabled={sending || !text.trim()} hitSlop={8}
            style={{ backgroundColor: c.primary, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.4 }}>
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
        </Row>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
