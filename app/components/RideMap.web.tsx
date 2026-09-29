import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/theme';

export interface LatLng {
  lat: number;
  lng: number;
}

// Aperçu web uniquement : react-native-maps n'existe pas sur le web.
export function RideMap({ style }: {
  pickup?: LatLng | null;
  dest?: LatLng | null;
  driver?: LatLng | null;
  me?: LatLng | null;
  style?: ViewStyle;
  showsUserLocation?: boolean;
}) {
  const c = useColors();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name="map-outline" size={56} color={c.textMuted} />
    </View>
  );
}
