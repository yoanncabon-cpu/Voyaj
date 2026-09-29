import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from '@/lib/payments';

export default function StripeRoot({ children }: { children: React.ReactElement | React.ReactElement[] }) {
  return (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.voyaj.app" urlScheme="voyaj">
      {children}
    </StripeProvider>
  );
}
