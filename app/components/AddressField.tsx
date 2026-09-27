import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Place } from '@/lib/api';
import { currentPlace, geocode } from '@/lib/location';
import { radius, space, useColors } from '@/lib/theme';

/**
 * Saisie d'adresse : l'adresse est convertie en coordonnées à la validation
 * (géocodeur du téléphone). Option « Ma position » pour le départ.
 */
export function AddressField({
  label, value, onChange, allowCurrentLocation, placeholder,
}: {
  label: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  allowCurrentLocation?: boolean;
  placeholder?: string;
}) {
  const c = useColors();
  const [text, setText] = useState(value?.address ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolve = async () => {
    if (text.trim().length < 3) return;
    if (value && value.address === text.trim()) return;
    setBusy(true);
    setError(null);
    const p = await geocode(text);
    setBusy(false);
    if (!p) {
      setError('Adresse introuvable, précisez (ville, code postal)');
      onChange(null);
    } else {
      onChange(p);
    }
  };

  const useMine = async () => {
    setBusy(true);
    setError(null);
    const p = await currentPlace().catch(() => null);
    setBusy(false);
    if (!p) {
      setError('Position indisponible : autorisez la localisation');
      return;
    }
    setText(p.address);
    onChange(p);
  };

  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.sm,
        borderColor: error ? c.danger : value ? c.success : c.border, backgroundColor: c.surface, paddingRight: 8,
      }}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (value) onChange(null);
          }}
          onEndEditing={resolve}
          onSubmitEditing={resolve}
          placeholder={placeholder ?? 'Adresse, ville'}
          placeholderTextColor={c.textMuted}
          returnKeyType="done"
          style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: c.text }}
        />
        {busy ? <ActivityIndicator color={c.primary} /> : value ? (
          <Ionicons name="checkmark-circle" size={22} color={c.success} />
        ) : allowCurrentLocation ? (
          <Pressable onPress={useMine} hitSlop={10} accessibilityLabel="Utiliser ma position">
            <Ionicons name="locate" size={22} color={c.primary} />
          </Pressable>
        ) : null}
      </View>
      {!!error && <Text style={{ color: c.danger, marginTop: 4, fontSize: 13 }}>{error}</Text>}
    </View>
  );
}
