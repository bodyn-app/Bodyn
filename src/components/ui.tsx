import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps, ReactNode, RefObject } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp, Text, TextProps, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { font, makeStyles, radius, space, useTheme } from '@/theme';

type Variant = keyof typeof font;

export function AppText({ variant = 'body', muted, lime, style, ...rest }: TextProps & { variant?: Variant; muted?: boolean; lime?: boolean }) {
  const { colors } = useTheme();
  return <Text {...rest} style={[{ color: lime ? colors.limeText : muted ? colors.textMuted : colors.text }, font[variant], style]} />;
}

/** Pass onPress to make the whole card tappable. */
export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const styles = useStyles();
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.7 }]}>
        {children}
      </Pressable>
    );
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="h2">{title}</AppText>
      {action ? (
        <Pressable onPress={onAction} hitSlop={12}>
          <AppText variant="small" lime>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Full-screen page with a back button, used for everything pushed on top of the tabs. Pass scrollEnabled={false} to freeze the page, e.g. while a drag gesture owns the vertical axis. */
export function DetailScreen({ title, children, footer, scrollRef, headerRight, scrollEnabled = true }: { title: string; children: ReactNode; footer?: ReactNode; scrollRef?: RefObject<ScrollView | null>; headerRight?: ReactNode; scrollEnabled?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.detailHeader}>
          <Pressable onPress={back} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <AppText variant="h2">{title}</AppText>
          {headerRight ?? <View style={{ width: 36 }} />}
        </View>
        <ScrollView ref={scrollRef} scrollEnabled={scrollEnabled} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A +/- numeric control that wraps at its bounds. Used anywhere a preference is a small bounded number (quiet hours, sleep goal, HR bpm). */
export function Stepper({ value, onChange, min, max, step, format }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number; format: (v: number) => string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const wrap = (v: number) => (v < min ? max : v > max ? min : v);
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(wrap(value - step))} hitSlop={8} style={styles.stepBtn} accessibilityLabel="Decrease">
        <Ionicons name="remove" size={16} color={colors.text} />
      </Pressable>
      <AppText variant="h3" style={{ minWidth: 54, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
        {format(value)}
      </AppText>
      <Pressable onPress={() => onChange(wrap(value + step))} hitSlop={8} style={styles.stepBtn} accessibilityLabel="Increase">
        <Ionicons name="add" size={16} color={colors.text} />
      </Pressable>
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <AppText variant="small" style={{ color: active ? colors.onLime : colors.textMuted, fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Small "label + value" stat like the "Distance 5.01 KM" cells in the reference. */
export function Stat({ icon, label, value, unit }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: string; unit?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={styles.row}>
        <Ionicons name={icon} size={11} color={colors.lime} />
        <AppText variant="tiny" muted>
          {label}
        </AppText>
      </View>
      <AppText variant="h3">
        {value}
        {unit ? (
          <AppText variant="small" muted>
            {' '}
            {unit}
          </AppText>
        ) : null}
      </AppText>
    </View>
  );
}

export const fmtDuration = (min: number | null | undefined) => {
  if (min == null) return '–';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
export const fmtNum = (n: number | null | undefined, d = 0) =>
  n == null ? '–' : n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

const useStyles = makeStyles((colors) => ({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, marginBottom: space.md },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.lime },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
}));
