import React, { useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, type TextInputProps, View, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useRouter } from 'expo-router';
import { radius, space, useColors } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function tap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== 'web') Haptics.impactAsync(style).catch(() => {});
}

export const shadow = {
  soft: { boxShadow: '0 2px 12px rgba(21, 22, 42, 0.07)' },
  raised: { boxShadow: '0 -6px 24px rgba(21, 22, 42, 0.12)' },
} as const;

/** Écran standard : fond, marges, défilement, clavier. */
export function Screen({
  title, children, scroll = true, back = true, edges, footer, right,
}: {
  title?: string;
  children: React.ReactNode;
  scroll?: boolean;
  back?: boolean;
  edges?: Edge[];
  footer?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const c = useColors();
  const router = useRouter();
  const body = scroll ? (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: space.xl * 2 }} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, padding: space.md }}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={edges ?? ['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      {title != null && (
        <View style={styles.header}>
          {back && router.canGoBack() ? (
            <Pressable hitSlop={10} onPress={() => { tap(); router.back(); }} accessibilityRole="button" accessibilityLabel="Retour"
              style={({ pressed }) => [styles.backBtn, { backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }, shadow.soft]}>
              <Ionicons name="chevron-back" size={22} color={c.text} />
            </Pressable>
          ) : <View style={{ width: 40 }} />}
          <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1} accessibilityRole="header">{title}</Text>
          <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
        </View>
      )}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer && <View style={{ padding: space.md, paddingTop: space.sm }}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Button({
  title, onPress, variant = 'primary', loading, disabled, icon, style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'light';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: ViewStyle;
}) {
  const c = useColors();
  const bg = { primary: c.accent, secondary: c.surfaceAlt, danger: c.danger, ghost: 'transparent', success: c.success, light: 'transparent' }[variant];
  const fg = {
    primary: c.onAccent, secondary: c.text, ghost: c.primary, danger: '#FFFFFF', success: c.onPrimary, light: '#FFFFFF',
  }[variant];
  const border = variant === 'light' ? { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' } : null;
  const off = disabled || loading;
  const lift = variant === 'primary' && !off ? { boxShadow: '0 6px 18px rgba(61, 220, 151, 0.35)' } : null;
  return (
    <Pressable
      onPress={() => { tap(variant === 'danger' ? Haptics.ImpactFeedbackStyle.Medium : undefined); onPress(); }}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: off ? 0.45 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
        lift,
        border,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={20} color={fg} style={{ marginRight: 8 }} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const c = useColors();
  const content = (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, shadow.soft, style]}>{children}</View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button"
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      {content}
    </Pressable>
  );
}

export function Field({ label, error, onFocus, onBlur, ...props }: TextInputProps & { label: string; error?: string | null }) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.danger : focused ? c.accent : c.border;
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[styles.label, { color: focused ? c.text : c.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.textMuted}
        accessibilityLabel={label}
        {...props}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[
          styles.input,
          { backgroundColor: focused ? c.surface : c.surfaceAlt, borderColor, color: c.text },
          focused && { boxShadow: `0 0 0 3px ${c.accentSoft}` },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
          props.multiline && { minHeight: 100, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {!!error && (
        <View style={[styles.row, { gap: 6, marginTop: 6 }]}>
          <Ionicons name="alert-circle" size={15} color={c.danger} />
          <Text style={{ color: c.danger, fontSize: 13, flex: 1 }} accessibilityLiveRegion="polite">{error}</Text>
        </View>
      )}
    </View>
  );
}

export function T({ children, variant = 'body', color, style, center, numberOfLines }: {
  children: React.ReactNode;
  variant?: 'title' | 'h2' | 'body' | 'small' | 'label' | 'big';
  color?: string;
  style?: object;
  center?: boolean;
  numberOfLines?: number;
}) {
  const c = useColors();
  const base = {
    big: { fontSize: 36, fontWeight: '800' as const, letterSpacing: -0.8 },
    title: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.6, lineHeight: 34 },
    h2: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
    body: { fontSize: 16, lineHeight: 22 },
    small: { fontSize: 13, lineHeight: 18 },
    label: { fontSize: 12, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  }[variant];
  const defaultColor = variant === 'small' || variant === 'label' ? c.textSecondary : c.text;
  return (
    <Text numberOfLines={numberOfLines} style={[base, { color: color ?? defaultColor }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
  );
}

/** En-tête des écrans de connexion : logo Voyaj, titre, sous-titre. */
export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const c = useColors();
  return (
    <View style={{ marginTop: space.sm, marginBottom: space.lg }}>
      <View style={[styles.authLogo, shadow.soft]}>
        <Image source={require('@/assets/icon.png')} style={{ width: '100%', height: '100%', borderRadius: 16 }} accessibilityLabel="Logo Voyaj" />
      </View>
      <T variant="title">{title}</T>
      {!!subtitle && <T color={c.textSecondary} style={{ marginTop: 6 }}>{subtitle}</T>}
    </View>
  );
}

export function Row({ children, style, gap = space.sm }: { children: React.ReactNode; style?: ViewStyle; gap?: number }) {
  return <View style={[styles.row, { gap }, style]}>{children}</View>;
}

export function Spacer({ h = space.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' }) {
  const c = useColors();
  const map = {
    neutral: [c.surfaceAlt, c.textSecondary],
    success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
    primary: [c.primarySoft, c.primary],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

export function ListItem({ icon, title, subtitle, onPress, right, danger }: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable onPress={onPress && (() => { tap(); onPress(); })} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.listItem, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
      {icon && (
        <View style={[styles.listIcon, { backgroundColor: danger ? c.dangerSoft : c.primarySoft }]}>
          <Ionicons name={icon} size={20} color={danger ? c.danger : c.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? c.danger : c.text, fontSize: 16, fontWeight: '600' }}>{title}</Text>
        {!!subtitle && <Text style={{ color: c.textSecondary, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {right ?? (onPress && <Ionicons name="chevron-forward" size={18} color={c.textMuted} />)}
    </Pressable>
  );
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg }}>
      <View style={[styles.emptyIcon, { backgroundColor: c.primarySoft }]}>
        <Ionicons name={icon} size={34} color={c.primary} />
      </View>
      <T variant="h2" center>{title}</T>
      {!!text && <T variant="small" center style={{ marginTop: 6 }}>{text}</T>}
      {action && <View style={{ marginTop: space.lg, alignSelf: 'stretch' }}>{action}</View>}
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}

/** Deux points reliés : départ (vert) → arrivée (couleur principale). */
export function Route({ from, to }: { from: string; to: string }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', paddingTop: 5 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.success }} />
        <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: c.border, marginVertical: 3 }} />
        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c.primary }} />
      </View>
      <View style={{ flex: 1, justifyContent: 'space-between', gap: 14 }}>
        <Text style={{ color: c.text, fontSize: 15 }} numberOfLines={2}>{from}</Text>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>{to}</Text>
      </View>
    </View>
  );
}

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const c = useColors();
  return (
    <Row gap={2}>
      <Ionicons name="star" size={size} color={c.gold} />
      <Text style={{ color: c.text, fontWeight: '700', fontSize: size - 2 }}>{Number(value).toFixed(1).replace('.', ',')}</Text>
    </Row>
  );
}

export function Avatar({ name, url, size = 48 }: { name?: string | null; url?: string | null; size?: number }) {
  const c = useColors();
  const initials = (name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.primary, fontWeight: '800', fontSize: size / 2.6 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: 8, gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center', letterSpacing: -0.3 },
  authLogo: { width: 56, height: 56, borderRadius: 16, marginBottom: space.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonText: { fontSize: 16, fontWeight: '800', letterSpacing: -0.1 },
  card: { borderRadius: radius.lg - 4, borderWidth: StyleSheet.hairlineWidth, padding: space.md + 2, marginBottom: space.md },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { borderWidth: 1.5, borderRadius: radius.md - 2, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  listIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
});
