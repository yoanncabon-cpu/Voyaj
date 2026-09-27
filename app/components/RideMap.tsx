import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/theme';

export interface LatLng {
  lat: number;
  lng: number;
}

// iOS : Apple Plans, sans clé. Android : Google Maps exige une clé
// (android.config.googleMaps.apiKey dans app.json) sauf dans Expo Go.
const androidMapsAvailable =
  Constants.appOwnership === 'expo' ||
  !!(Constants.expoConfig?.android as { config?: { googleMaps?: { apiKey?: string } } } | undefined)?.config?.googleMaps?.apiKey;

export function RideMap({
  pickup, dest, driver, me, style, showsUserLocation = true,
}: {
  pickup?: LatLng | null;
  dest?: LatLng | null;
  driver?: LatLng | null;
  me?: LatLng | null;
  style?: ViewStyle;
  showsUserLocation?: boolean;
}) {
  const c = useColors();
  const ref = useRef<MapView>(null);
  const points = [pickup, dest, driver, me].filter(Boolean) as LatLng[];
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');

  useEffect(() => {
    if (!ref.current || points.length === 0) return;
    if (points.length === 1) {
      ref.current.animateToRegion({ latitude: points[0].lat, longitude: points[0].lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
      return;
    }
    ref.current.fitToCoordinates(points.map((p) => ({ latitude: p.lat, longitude: p.lng })), {
      edgePadding: { top: 80, right: 60, bottom: 260, left: 60 },
      animated: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (Platform.OS === 'android' && !androidMapsAvailable) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }, style]}>
        <Ionicons name="map-outline" size={56} color={c.textMuted} />
      </View>
    );
  }

  const initial = points[0] ?? { lat: 48.8566, lng: 2.3522 };
  return (
    <MapView
      ref={ref}
      style={[StyleSheet.absoluteFill, style]}
      initialRegion={{ latitude: initial.lat, longitude: initial.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {pickup && <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} title="Départ" pinColor="green" />}
      {dest && <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} title="Arrivée" pinColor={c.primary} />}
      {driver && (
        <Marker coordinate={{ latitude: driver.lat, longitude: driver.lng }} title="Chauffeur" anchor={{ x: 0.5, y: 0.5 }}>
          <View style={{ backgroundColor: c.primary, borderRadius: 18, padding: 6, borderWidth: 2, borderColor: '#fff' }}>
            <Ionicons name="car" size={18} color="#fff" />
          </View>
        </Marker>
      )}
      {pickup && dest && (
        <Polyline
          coordinates={[{ latitude: pickup.lat, longitude: pickup.lng }, { latitude: dest.lat, longitude: dest.lng }]}
          strokeColor={c.primary}
          strokeWidth={3}
          lineDashPattern={[6, 6]}
        />
      )}
    </MapView>
  );
}
