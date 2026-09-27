import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AddressField } from '@/components/AddressField';
import { Button, Card, Row, Screen, Spacer, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api, ApiError, type Place } from '@/lib/api';
import { eur, km } from '@/lib/format';
import { currentPlace } from '@/lib/location';
import { pay } from '@/lib/payments';
import { useColors } from '@/lib/theme';
import type { PriceBreakdown } from '@/lib/types';

export default function NewRide() {
  const c = useColors();
  const router = useRouter();
  const { profile } = useAuth();
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dest, setDest] = useState<Place | null>(null);
  const [estimate, setEstimate] = useState<{ price: PriceBreakdown; distanceKm: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    currentPlace().then((p) => p && setPickup(p)).catch(() => {});
  }, []);

  useEffect(() => {
    setEstimate(null);
    if (!pickup || !dest) return;
    setEstimating(true);
    api.priceEstimate(pickup, dest)
      .then(setEstimate)
      .catch(() => setEstimate(null))
      .finally(() => setEstimating(false));
  }, [pickup, dest]);

  const request = async () => {
    if (!pickup || !dest) return;
    setBusy(true);
    try {
      const r = await api.requestRide(pickup, dest);
      // Autorisation seulement : rien n'est prélevé avant la fin de la course.
      const ok = await pay(r, profile?.name);
      if (!ok) {
        setBusy(false);
        return;
      }
      await api.confirmRidePayment(r.rideId);
      router.replace(`/ride/${r.rideId}`);
    } catch (e) {
      setBusy(false);
      Alert.alert('Demande impossible', e instanceof ApiError || e instanceof Error ? e.message : 'Réessayez.');
    }
  };

  return (
    <Screen title="Course immédiate"
      footer={<Button title={estimate ? `Commander · ${eur(estimate.price.passengerTotalEur)}` : 'Commander'}
        onPress={request} loading={busy} disabled={!estimate} icon="car" />}>
      {pickup ? (
        <AddressField key={`p-${pickup.address}`} label="Départ" value={pickup} onChange={setPickup} allowCurrentLocation />
      ) : (
        <AddressField label="Départ" value={null} onChange={setPickup} allowCurrentLocation />
      )}
      <AddressField label="Destination" value={dest} onChange={setDest} placeholder="Adresse, gare, ville…" />

      {estimating && <T variant="small">Calcul du prix…</T>}
      {estimate && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="small">Distance estimée</T>
            <T>{km(estimate.distanceKm)}</T>
          </Row>
          <Spacer h={8} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="small">Part des frais du trajet</T>
            <T>{eur(estimate.price.passengerShareEur)}</T>
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <T variant="small">Frais de service Voyaj</T>
            <T>{eur(estimate.price.voyajFeeEur)}</T>
          </Row>
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 12 }} />
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h2">Total</T>
            <T variant="h2" color={c.primary}>{eur(estimate.price.passengerTotalEur)}</T>
          </Row>
          <T variant="small" style={{ marginTop: 10 }}>
            Le montant est seulement réservé sur votre carte. Il n&apos;est prélevé qu&apos;une fois arrivé·e.
            Aucun chauffeur sous 90 secondes ? La réservation est annulée.
          </T>
        </Card>
      )}
    </Screen>
  );
}
