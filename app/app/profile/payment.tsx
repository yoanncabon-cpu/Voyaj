import { useState } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Badge, Button, Card, Screen, Spacer, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

export default function Payment() {
  const { profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  const openStripe = async () => {
    setBusy(true);
    try {
      const r = await api.stripeConnect();
      await WebBrowser.openBrowserAsync(r.url);
      await refreshProfile();
    } catch (e) {
      Alert.alert('Erreur', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Paiements et gains">
      <Card>
        <T variant="h2">Payer vos trajets</T>
        <T variant="small" style={{ marginTop: 6 }}>
          Votre carte est demandée au moment de commander, via Stripe. Voyaj ne voit ni ne stocke jamais son numéro.
          Les cartes utilisées sont proposées automatiquement la fois suivante.
        </T>
      </Card>
      <Card>
        <T variant="h2">Recevoir vos gains (chauffeur)</T>
        <Spacer h={8} />
        {profile?.stripe_payouts_enabled ? <Badge text="Virements actifs" tone="success" /> :
          profile?.stripe_account_id ? <Badge text="Inscription à terminer" tone="warning" /> : <Badge text="Non configuré" />}
        <T variant="small" style={{ marginTop: 10 }}>
          Vos gains sont virés sur votre compte bancaire par Stripe, après la confirmation de chaque course
          (ou 24 h après un trajet programmé). Stripe vous demandera votre identité et votre IBAN.
        </T>
        <Spacer />
        <Button title={profile?.stripe_account_id ? 'Ouvrir mon espace Stripe' : 'Configurer mes virements'}
          icon="open-outline" onPress={openStripe} loading={busy} disabled={!profile?.is_verified} />
        {!profile?.is_verified && <T variant="small" style={{ marginTop: 8 }}>Vérifiez d&apos;abord votre identité.</T>}
      </Card>
    </Screen>
  );
}
