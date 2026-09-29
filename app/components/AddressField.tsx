import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Place } from '@/lib/api';
import { currentPlace, geocode, searchPlaces, type PlaceSuggestion } from '@/lib/location';
import { radius, space, useColors } from '@/lib/theme';
import { shadow, tap } from '@/components/ui';

const ICONS: Record<PlaceSuggestion['kind'], React.ComponentProps<typeof Ionicons>['name']> = {
  city: 'business',
  street: 'git-commit',
  address: 'home',
  transport: 'train',
  place: 'flag',
};

/** Saisie d'adresse avec suggestions en direct, comme Plans ou Google Maps. */
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
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    if (value?.address && value.address !== text) setText(value.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.address]);

  useEffect(() => {
    const q = text.trim();
    if (!focused || q.length < 2 || value?.address === q) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      request.current?.abort();
      const ctrl = new AbortController();
      request.current = ctrl;
      setBusy(true);
      try {
        const list = await searchPlaces(q, ctrl.signal);
        if (!ctrl.signal.aborted) {
          setSuggestions(list);
          setError(null);
        }
      } catch {
        if (!ctrl.signal.aborted) setSuggestions([]);
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [text, focused, value?.address]);

  const pick = (s: PlaceSuggestion) => {
    tap();
    request.current?.abort();
    setText(s.place.address);
    setSuggestions([]);
    setError(null);
    setBusy(false);
    onChange(s.place);
    Keyboard.dismiss();
  };

  // Validation au clavier : première suggestion, sinon géocodeur du téléphone.
  const submit = async () => {
    if (suggestions[0]) return pick(suggestions[0]);
    const q = text.trim();
    if (q.length < 3 || value?.address === q) return;
    setBusy(true);
    const p = await geocode(q);
    setBusy(false);
    if (p) onChange(p);
    else setError('Adresse introuvable, précisez la ville ou le code postal');
  };

  const useMine = async () => {
    tap();
    setBusy(true);
    setError(null);
    const p = await currentPlace().catch(() => null);
    setBusy(false);
    if (!p) {
      setError('Position indisponible : autorisez la localisation');
      return;
    }
    setText(p.address);
    setSuggestions([]);
    onChange(p);
  };

  const borderColor = error ? c.danger : focused ? c.accent : value ? c.success : c.border;

  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={{ color: focused ? c.text : c.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 7 }}>{label}</Text>
      <View style={[{
        flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: radius.md - 2, borderColor,
        backgroundColor: focused ? c.surface : c.surfaceAlt, paddingLeft: 14, paddingRight: 10, gap: 10,
      }, focused && { boxShadow: `0 0 0 3px ${c.accentSoft}` }]}>
        <Ionicons name={value ? 'location' : 'search'} size={18} color={value ? c.success : c.textMuted} />
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(null);
            if (value) onChange(null);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onSubmitEditing={submit}
          placeholder={placeholder ?? 'Ville, adresse, gare…'}
          placeholderTextColor={c.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={label}
          style={[{ flex: 1, paddingVertical: 14, fontSize: 16, color: c.text },
            Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
        />
        {busy ? <ActivityIndicator color={c.primary} /> : value ? (
          <Ionicons name="checkmark-circle" size={22} color={c.success} />
        ) : text ? (
          <Pressable onPress={() => { setText(''); setSuggestions([]); }} hitSlop={10} accessibilityLabel="Effacer">
            <Ionicons name="close-circle" size={20} color={c.textMuted} />
          </Pressable>
        ) : allowCurrentLocation ? (
          <Pressable onPress={useMine} hitSlop={10} accessibilityLabel="Utiliser ma position">
            <Ionicons name="locate" size={22} color={c.primary} />
          </Pressable>
        ) : null}
      </View>

      {suggestions.length > 0 && (
        <View style={[{ marginTop: 6, borderRadius: radius.md, backgroundColor: c.surface, overflow: 'hidden' }, shadow.soft]}
          accessibilityRole="list">
          {allowCurrentLocation && (
            <SuggestionRow icon="locate" title="Ma position actuelle" subtitle="Utiliser le GPS du téléphone" onPress={useMine} highlight />
          )}
          {suggestions.map((s, i) => (
            <SuggestionRow key={s.id} icon={ICONS[s.kind]} title={s.title} subtitle={s.subtitle} onPress={() => pick(s)}
              last={i === suggestions.length - 1} />
          ))}
        </View>
      )}

      {!!error && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <Ionicons name="alert-circle" size={15} color={c.danger} />
          <Text style={{ color: c.danger, fontSize: 13, flex: 1 }}>{error}</Text>
        </View>
      )}
    </View>
  );
}

function SuggestionRow({ icon, title, subtitle, onPress, last, highlight }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
  highlight?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11,
        backgroundColor: pressed ? c.surfaceAlt : 'transparent',
        borderBottomWidth: last ? 0 : 1, borderBottomColor: c.border,
      })}>
      <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
        backgroundColor: highlight ? c.accentSoft : c.surfaceAlt }}>
        <Ionicons name={icon} size={17} color={highlight ? c.success : c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 1 }} numberOfLines={1}>{subtitle}</Text>}
      </View>
    </Pressable>
  );
}
