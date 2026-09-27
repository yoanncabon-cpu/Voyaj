import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Badge, Card, Empty, Route, Row, Screen, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { dateTime, eur, RIDE_STATUS_LABEL } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Ride } from '@/lib/types';

export default function History() {
  const router = useRouter();
  const { userId } = useAuth();
  const [rides, setRides] = useState<Ride[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from('rides').select('*')
      .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
      .neq('status', 'awaiting_payment')
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setRides((data as Ride[]) ?? []));
  }, [userId]);

  return (
    <Screen title="Historique">
      {rides?.length === 0 && <Empty icon="time-outline" title="Aucune course" text="Vos courses immédiates apparaîtront ici." />}
      {rides?.map((r) => {
        const driver = r.driver_id === userId;
        const tone = r.status === 'confirmed' ? 'success' : ['cancelled', 'expired', 'passenger_absent'].includes(r.status) ? 'danger' : 'primary';
        return (
          <Card key={r.id} onPress={() => router.push(r.status === 'confirmed' ? `/ride/summary/${r.id}` : driver ? `/driver/ride/${r.id}` : `/ride/${r.id}`)}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <T variant="small">{dateTime(r.created_at)} · {driver ? 'Chauffeur' : 'Passager'}</T>
              <T variant="h2">{eur(driver ? r.price.driverEarningsEur : r.price.passengerTotalEur)}</T>
            </Row>
            <Route from={r.pickup_address} to={r.dest_address} />
            <Row style={{ marginTop: 10 }}><Badge text={RIDE_STATUS_LABEL[r.status]} tone={tone} /></Row>
          </Card>
        );
      })}
    </Screen>
  );
}
