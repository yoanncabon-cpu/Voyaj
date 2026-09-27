import { useEffect, useRef, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Screen, Spacer, T } from '@/components/ui';
import { api } from '@/lib/api';
import { ensureLocationPermission } from '@/lib/location';
import { useColors } from '@/lib/theme';

/**
 * « Je suis bien rentré » : un lien public (sans compte) montre la position
 * à un proche jusqu'à l'arrivée. La position est mise à jour tant que l'écran
 * est ouvert.
 */
export default function SafeReturn() {
  const c = useColors();
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const watcher = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    api.safeReturn('status').then((r) => {
      if (r.active && r.url) {
        setUrl(r.url);
        setExpiresAt(r.expiresAt ?? null);
      }
    }).catch(() => {});
  }, []);

  // Suivi de position pendant que le partage est actif.
  useEffect(() => {
    if (!url) return;
    let stop = false;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 30_000, distanceInterval: 50 },
      (loc) => api.safeReturn('update', { lat: loc.coords.latitude, lng: loc.coords.longitude }).catch(() => {}))
      .then((sub) => (stop ? sub.remove() : (watcher.current = sub)));
    return () => {
      stop = true;
      watcher.current?.remove();
    };
  }, [url]);

  const start = async () => {
    setBusy(true);
    try {
      if (!(await ensureLocationPermission())) throw new Error('Autorisez la localisation');
      const pos = await Location.getCurrentPositionAsync({});
      const r = await api.safeReturn('start', { lat: pos.coords.latitude, lng: pos.coords.longitude });
      setUrl(r.url ?? null);
      setExpiresAt(r.expiresAt ?? null);
      if (r.url) await Share.share({ message: `Je rentre, suis mon trajet en direct : ${r.url}` });
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const arrived = async () => {
    setBusy(true);
    await api.safeReturn('arrived').catch(() => {});
    setUrl(null);
    setBusy(false);
    Alert.alert('Bien rentré·e ✅', 'Vos proches voient que vous êtes arrivé·e. Le partage de position est arrêté.');
  };

  return (
    <Screen title="Je suis bien rentré">
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <Ionicons name={url ? 'radio' : 'home'} size={80} color={url ? c.success : c.primary} />
      </View>
      {url ? (
        <>
          <T variant="h2" center>Partage en cours</T>
          <T variant="small" center style={{ marginTop: 6 }}>
            Gardez cet écran ouvert pour mettre à jour votre position.
            {expiresAt ? ` Fin automatique à ${new Date(expiresAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.` : ''}
          </T>
          <Spacer />
          <Card><T variant="small">{url}</T></Card>
          <Button title="Partager le lien" variant="secondary" icon="share-social" onPress={() => Share.share({ message: `Suis mon trajet en direct : ${url}` })} />
          <Spacer h={10} />
          <Button title="Je suis bien arrivé·e" variant="success" icon="checkmark-circle" onPress={arrived} loading={busy} />
        </>
      ) : (
        <>
          <T variant="h2" center>Rassurez vos proches</T>
          <T variant="small" center style={{ marginTop: 6 }}>
            Envoyez un lien : ils suivent votre retour sur une carte, sans application, jusqu&apos;à ce que vous confirmiez votre arrivée.
          </T>
          <Spacer h={24} />
          <Button title="Démarrer et partager" icon="navigate" onPress={start} loading={busy} />
        </>
      )}
    </Screen>
  );
}
