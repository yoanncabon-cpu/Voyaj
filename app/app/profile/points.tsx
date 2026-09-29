import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, ListItem, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { brand, radius, useColors } from '@/lib/theme';
import type { Reward } from '@/lib/types';

interface Redemption { id: string; code: string; reward_id: string; status: string; created_at: string }

const EARN = [
  { icon: 'car' as const, text: 'Course effectuée (passager)', pts: 10 },
  { icon: 'car-sport' as const, text: 'Course effectuée (chauffeur)', pts: 20 },
  { icon: 'star' as const, text: 'Noter après un trajet', pts: 5 },
];

export default function Points() {
  const c = useColors();
  const { profile } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [mine, setMine] = useState<Redemption[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const balance = profile?.points_balance ?? 0;

  const load = useCallback(async () => {
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from('rewards').select('*').order('points_cost'),
      supabase.from('redemptions').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    setRewards((r as Reward[]) ?? []);
    setMine((m as Redemption[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const redeem = (reward: Reward) => Alert.alert(reward.title, `Échanger ${reward.points_cost} points ?`, [
    { text: 'Annuler', style: 'cancel' },
    {
      text: 'Échanger', onPress: async () => {
        setBusy(reward.id);
        try {
          const r = await api.redeem(reward.id);
          await Clipboard.setStringAsync(r.code);
          Alert.alert('C\'est à vous 🎉', `Votre code : ${r.code}\n(copié dans le presse-papiers)`);
          load();
        } catch (e) {
          Alert.alert('Échange impossible', (e as Error).message);
        } finally {
          setBusy(null);
        }
      },
    },
  ]);

  return (
    <Screen title="Points Voyaj">
      <View style={{ backgroundColor: brand.navy, borderRadius: radius.lg, padding: 24, alignItems: 'center', marginBottom: 16 }}>
        <T color={brand.cream} style={{ opacity: 0.8 }}>Votre solde</T>
        <T variant="big" color={brand.green}>{balance} pts</T>
      </View>
      <T variant="label" style={{ marginBottom: 8 }}>Gagner des points</T>
      <Card>
        {EARN.map((e) => (
          <Row key={e.text} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
            <Row gap={10}><Ionicons name={e.icon} size={18} color={c.primary} /><T>{e.text}</T></Row>
            <T style={{ fontWeight: '700' }} color={c.gold}>+{e.pts}</T>
          </Row>
        ))}
      </Card>
      <T variant="label" style={{ marginBottom: 8 }}>Récompenses</T>
      {rewards.map((r) => (
        <Card key={r.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T variant="h2">{r.title}</T>
              <T variant="small" color={c.gold} style={{ fontWeight: '700' }}>{r.points_cost} points</T>
            </View>
            <Button title="Échanger" variant={balance >= r.points_cost ? 'primary' : 'secondary'} disabled={balance < r.points_cost}
              loading={busy === r.id} onPress={() => redeem(r)} style={{ minHeight: 40, paddingHorizontal: 14 }} />
          </Row>
        </Card>
      ))}
      {mine.length > 0 && <T variant="label" style={{ marginVertical: 8 }}>Mes codes</T>}
      {mine.map((m) => (
        <ListItem key={m.id} icon="pricetag" title={m.code} subtitle={`${rewards.find((r) => r.id === m.reward_id)?.title ?? m.reward_id} · ${shortDate(m.created_at)}`}
          onPress={() => Clipboard.setStringAsync(m.code).then(() => Alert.alert('Code copié'))} />
      ))}
    </Screen>
  );
}
