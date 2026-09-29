import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { subscribeToForegroundRideRequests, subscribeToNotificationTaps } from '@/lib/notifications';
import { Loading } from '@/components/ui';
import StripeRoot from '@/components/StripeRoot';

/**
 * Garde de navigation : non connecté → accueil ; connecté sans CGU acceptées
 * → écran des conditions ; sinon l'app.
 */
function AuthGate() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const group = segments[0];
    const inAuth = group === '(auth)';
    const inOnboarding = group === 'onboarding';
    if (!session) {
      if (!inAuth) router.replace('/(auth)/welcome');
    } else if (profile && !profile.terms_accepted_at) {
      if (!inOnboarding) router.replace('/onboarding/terms');
    } else if (profile && (inAuth || inOnboarding)) {
      router.replace('/(tabs)');
    }
  }, [session, profile, loading, segments, router]);

  return null;
}

/** Notifications : toucher → écran concerné ; demande de course reçue app ouverte → écran d'acceptation. */
function NotificationRouter() {
  const router = useRouter();
  const { userId } = useAuth();
  useEffect(() => {
    if (!userId) return;
    const go = (route: string) => setTimeout(() => router.push(route as never), 300);
    const offTap = subscribeToNotificationTaps(go);
    const offRequests = subscribeToForegroundRideRequests(go);
    return () => {
      offTap();
      offRequests();
    };
  }, [userId, router]);
  return null;
}

function Root() {
  const { loading } = useAuth();
  if (loading) return <Loading />;
  return (
    <>
      <AuthGate />
      <NotificationRouter />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="driver/offer/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StripeRoot>
        <AuthProvider>
          <StatusBar style="auto" />
          <Root />
        </AuthProvider>
      </StripeRoot>
    </SafeAreaProvider>
  );
}
