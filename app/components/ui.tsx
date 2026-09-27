import React from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text,
  TextInput, type TextInputProps, View, type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { radius, space, useColors } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

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
            <Pressable hitSlop={12} onPress={() => router.back()} accessibilityLabel="Retour">
              <Ionicons name="chevron-back" size={26} color={c.text} />
            </Pressable>
          ) : <View style={{ width: 26 }} />}
          <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>{title}</Text>
          <View style={{ minWidth: 26, alignItems: 'flex-end' }}>{right}</View>
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
  const bg = { primary: c.primary, secondary: c.surfaceAlt, danger: c.danger, ghost: 'transparent', success: c.success, light: 'transparent' }[variant];
  const fg = variant === 'secondary' ? c.text : variant === 'ghost' ? c.primary : c.onPrimary;
  const border = variant === 'light' ? { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' } : null;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
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
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }, style]}>{children}</View>
  );
  if (!onPress) return content;
  return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>{content}</Pressable>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.textMuted}
        {...props}
        style={[
          styles.input,
          { backgroundColor: c.surface, borderColor: error ? c.danger : c.border, color: c.text },
          props.multiline && { minHeight: 100, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {!!error && <Text style={{ color: c.danger, marginTop: 4, fontSize: 13 }}>{error}</Text>}
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
    big: { fontSize: 34, fontWeight: '800' as const },
    title: { fontSize: 26, fontWeight: '800' as const },
    h2: { fontSize: 18, fontWeight: '700' as const },
    body: { fontSize: 16 },
    small: { fontSize: 13 },
    label: { fontSize: 13, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  }[variant];
  const defaultColor = variant === 'small' || variant === 'label' ? c.textSecondary : c.text;
  return (
    <Text numberOfLines={numberOfLines} style={[base, { color: color ?? defaultColor }, center && { textAlign: 'center' }, style]}>
      {children}
    </Text>
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
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listItem, { borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: 10, gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  button: { minHeight: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonText: { fontSize: 16, fontWeight: '700' },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.md, marginBottom: space.md },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  listIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
});
