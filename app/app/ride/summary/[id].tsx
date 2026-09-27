import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Field, Loading, Route, Row, Screen, Spacer, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { eur, km } from '@/lib/format';
import { useRide } from '@/lib/hooks';
import { useColors } from '@/lib/theme';

export default function RideSummary() {
  const c = useColors();
  const router = useRouter();
  const { userId } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ride, loading } = useRide(id);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [rated, setRated] = useState(false);

  if (loading || !ride) return <Loading />;
  const isDriver = ride.driver_id === userId;

  const submit = async () => {
    setBusy(true);
    try {
      await api.rate(ride.id, 'instant', score, comment || undefined);
      setRated(true);
    } catch (e) {
      Alert.alert('Note non envoyée', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Course terminée" back={false}
      footer={<Button title="Retour à l'accueil" variant={rated ? 'primary' : 'secondary'} onPress={() => router.replace('/(tabs)')} />}>
      <View style={{ alignItems: 'center', marginVertical: 16 }}>
        <Ionicons name="checkmark-circle" size={72} color={c.success} />
        <T variant="title" center>Merci d&apos;avoir voyagé avec Voyaj</T>
      </View>

      <Card>
        <Route from={ride.pickup_address} to={ride.dest_address} />
        <Spacer h={12} />
        <Row style={{ justifyContent: 'space-between' }}><T variant="small">Distance</T><T>{km(ride.distance_km)}</T></Row>
        {isDriver ? (
          <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <T variant="h2">Vos gains</T><T variant="h2" color={c.success}>{eur(ride.price.driverEarningsEur)}</T>
          </Row>
        ) : (
          <>
            <Row style={{ justifyContent: 'space-between', marginTop: 6 }}><T variant="small">Part des frais</T><T>{eur(ride.price.passengerShareEur)}</T></Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 6 }}><T variant="small">Frais de service</T><T>{eur(ride.price.voyajFeeEur)}</T></Row>
            <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <T variant="h2">Total payé</T><T variant="h2" color={c.primary}>{eur(ride.price.passengerTotalEur)}</T>
            </Row>
          </>
        )}
      </Card>

      {rated ? (
        <Card><T center>Merci pour votre note ! +5 points 🎉</T></Card>
      ) : (
        <Card>
          <T variant="h2" center>{isDriver ? 'Notez votre passager' : 'Notez votre chauffeur'}</T>
          <Row style={{ justifyContent: 'center', marginVertical: 14 }} gap={6}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setScore(n)} hitSlop={6} accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`}>
                <Ionicons name={n <= score ? 'star' : 'star-outline'} size={40} color={c.gold} />
              </Pressable>
            ))}
          </Row>
          {score > 0 && (
            <>
              <Field label="Commentaire (facultatif)" value={comment} onChangeText={setComment} multiline maxLength={500} />
              <Button title="Envoyer ma note" onPress={submit} loading={busy} />
            </>
          )}
        </Card>
      )}

      {!ride.has_dispute && (
        <Button title="Signaler un problème" variant="ghost" onPress={() => router.push(`/dispute/${ride.id}?kind=instant`)} />
      )}
    </Screen>
  );
}
