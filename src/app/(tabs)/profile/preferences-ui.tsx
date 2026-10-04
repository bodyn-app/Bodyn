import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { ScoreRings } from '@/components/score-rings';
import { AppText, Card, DetailScreen, SectionHeader } from '@/components/ui';
import { health } from '@/health';
import { DEFAULT_TABS, useDefaultTab } from '@/state/default-tab';
import { RING_IDS, RING_LABEL, useRingOrder } from '@/state/ring-order';
import { makeStyles, radius, space, type ThemeMode, useTheme, useThemeMode } from '@/theme';

const MODES: { mode: ThemeMode; label: string; icon: ComponentProps<typeof Ionicons>['name']; hint: string }[] = [
  { mode: 'light', label: 'Light', icon: 'sunny', hint: 'Always light' },
  { mode: 'dark', label: 'Dark', icon: 'moon', hint: 'Always dark' },
  { mode: 'system', label: 'System', icon: 'phone-portrait-outline', hint: 'Match your phone' },
];

/** Appearance, units, default tab and (once built) home-screen layout. */
export default function PreferencesUI() {
  const styles = useStyles();
  const { colors, scheme, mode } = useTheme();
  const setMode = useThemeMode((s) => s.setMode);
  const router = useRouter();
  const { tab, setTab } = useDefaultTab();
  const { order, swap, reset } = useRingOrder();

  return (
    <DetailScreen title="UI Customization">
      <SectionHeader title="Appearance" />
      <Card style={{ gap: space.md }}>
        <View style={styles.segment}>
          {MODES.map((m) => {
            const on = mode === m.mode;
            return (
              <Pressable key={m.mode} onPress={() => setMode(m.mode)} style={[styles.option, on && styles.optionOn]}>
                <Ionicons name={m.icon} size={20} color={on ? colors.onLime : colors.textMuted} />
                <AppText variant="small" style={{ color: on ? colors.onLime : colors.text, fontWeight: '600' }}>
                  {m.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="tiny" muted>
          {MODES.find((m) => m.mode === mode)?.hint}
          {mode === 'system' ? ` · currently ${scheme}` : ''}
        </AppText>
      </Card>

      <SectionHeader title="Home Rings" action="Reset" onAction={reset} />
      <Card style={{ gap: space.lg }}>
        <ScoreRings date={health.lastDay} preview />
        <AppText variant="small" muted>
          Pick which score sits in each position. Choosing one that is already somewhere else swaps the two.
        </AppText>
        {order.map((ringId, position) => (
          <View key={position} style={{ gap: space.sm }}>
            <AppText variant="tiny" muted style={{ letterSpacing: 0.6 }}>
              POSITION {position + 1}
            </AppText>
            <View style={styles.chips}>
              {RING_IDS.map((id) => {
                const on = ringId === id;
                return (
                  <Pressable key={id} onPress={() => swap(position, id)} style={[styles.chip, on && styles.chipActive]}>
                    <AppText variant="small" style={{ color: on ? colors.onLime : colors.textMuted, fontWeight: '600' }}>
                      {RING_LABEL[id]}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </Card>

      <SectionHeader title="Preferences" />
      <View style={{ gap: space.md }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} onPress={() => router.push('/profile/preferences-units')}>
          <Ionicons name="swap-horizontal-outline" size={20} color={colors.limeText} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Units</AppText>
            <AppText variant="small" muted>
              Distance, weight and energy
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Card>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} onPress={() => router.push('/profile/preferences-home-layout')}>
          <Ionicons name="grid-outline" size={20} color={colors.limeText} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Home Layout</AppText>
            <AppText variant="small" muted>
              Reorder, add or remove your home cards
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Card>

        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Ionicons name="apps-outline" size={20} color={colors.limeText} />
            <View style={{ flex: 1 }}>
              <AppText variant="h3">Default Tab</AppText>
              <AppText variant="small" muted>
                Which tab opens when you launch Bodyn
              </AppText>
            </View>
          </View>
          <View style={styles.chips}>
            {DEFAULT_TABS.map((t) => {
              const on = tab === t.tab;
              return (
                <Pressable key={t.tab} onPress={() => setTab(t.tab)} style={[styles.chip, on && styles.chipActive]}>
                  <AppText variant="small" style={{ color: on ? colors.onLime : colors.textMuted, fontWeight: '600' }}>
                    {t.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </View>
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  segment: { flexDirection: 'row', gap: space.sm },
  option: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  optionOn: { backgroundColor: colors.lime },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.lime },
}));
