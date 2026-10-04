import { Pressable, View } from 'react-native';

import { AppText, Card, DetailScreen, SectionHeader, Stepper } from '@/components/ui';
import { health } from '@/health';
import { metrics } from '@/metrics';
import { type ZoneBands, useHealthPrefs } from '@/state/health-prefs';
import { makeStyles, space, useTheme } from '@/theme';

const DEFAULT_BANDS: ZoneBands = [0.6, 0.7, 0.8, 0.9];
const ZONE_COLORS = (c: ReturnType<typeof useTheme>['colors']) => [c.good, c.warn, '#F2913A', c.bad, '#B14FD9'];

const MAX_SOURCES = [{ v: 'auto' as const, label: 'Auto' }, { v: 'manual' as const, label: 'Manual' }];
const REST_SOURCES = [{ v: 'auto' as const, label: 'Apple' }, { v: 'sleep' as const, label: 'Sleep' }, { v: 'manual' as const, label: 'Manual' }];

function SourceToggle<T extends string>({ source, options, onChange }: { source: T; options: { v: T; label: string }[]; onChange: (s: T) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.toggle}>
      {options.map((o) => {
        const on = source === o.v;
        return (
          <Pressable key={o.v} onPress={() => onChange(o.v)} style={[styles.toggleOpt, on && { backgroundColor: colors.text }]}>
            <AppText variant="small" style={{ color: on ? colors.bg : colors.textMuted, fontWeight: '700' }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Max HR / resting HR sources feed `hrProfile()`, and zone bands feed `zoneMinutes()`, both in the metrics engine. */
export default function PreferencesHeart() {
  const styles = useStyles();
  const { colors } = useTheme();
  const prefs = useHealthPrefs();
  const computed = metrics.hrProfile(health.lastDay);
  const bands = prefs.zoneBands ?? DEFAULT_BANDS;
  const hrMax = prefs.hrMaxSource === 'manual' ? (prefs.hrMaxManual ?? Math.round(computed.hrMax)) : Math.round(computed.hrMax);
  const edges = [0, ...bands, 1];
  const zoneColors = ZONE_COLORS(colors);

  return (
    <DetailScreen title="Heart Preferences">
      <SectionHeader title="Maximum Heart Rate" />
      <Card style={{ gap: space.md }}>
        <SourceToggle source={prefs.hrMaxSource} options={MAX_SOURCES} onChange={(s) => prefs.set({ hrMaxSource: s, hrMaxManual: prefs.hrMaxManual ?? Math.round(computed.hrMax) })} />
        {prefs.hrMaxSource === 'auto' ? (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <AppText>Age formula</AppText>
              <AppText variant="tiny" muted>
                Tanaka: 208 − (0.7 × age)
              </AppText>
            </View>
            <AppText variant="h2">
              {Math.round(computed.hrMax)} <AppText variant="small" muted>BPM</AppText>
            </AppText>
          </View>
        ) : (
          <View style={styles.row}>
            <AppText style={{ flex: 1 }}>Your max HR</AppText>
            <Stepper value={prefs.hrMaxManual ?? Math.round(computed.hrMax)} onChange={(v) => prefs.set({ hrMaxManual: v })} min={140} max={220} step={1} format={(v) => `${v}`} />
          </View>
        )}
      </Card>

      <SectionHeader title="Resting Heart Rate" />
      <Card style={{ gap: space.md }}>
        <SourceToggle source={prefs.hrRestSource} options={REST_SOURCES} onChange={(s) => prefs.set({ hrRestSource: s, hrRestManual: prefs.hrRestManual ?? Math.round(computed.hrRest) })} />
        {prefs.hrRestSource !== 'manual' ? (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <AppText>{prefs.hrRestSource === 'sleep' ? 'From your sleep' : 'From Apple Health'}</AppText>
              <AppText variant="tiny" muted>
                {prefs.hrRestSource === 'sleep' ? 'Average heart rate across the night — steadier day to day' : "Apple's own daily resting heart rate, 30-day median"}
              </AppText>
            </View>
            <AppText variant="h2">
              {Math.round(computed.hrRest)} <AppText variant="small" muted>BPM</AppText>
            </AppText>
          </View>
        ) : (
          <View style={styles.row}>
            <AppText style={{ flex: 1 }}>Your resting HR</AppText>
            <Stepper value={prefs.hrRestManual ?? Math.round(computed.hrRest)} onChange={(v) => prefs.set({ hrRestManual: v })} min={35} max={100} step={1} format={(v) => `${v}`} />
          </View>
        )}
      </Card>

      <SectionHeader title="Heart Rate Zones" />
      <AppText variant="small" muted style={{ marginBottom: space.md, marginTop: -space.sm }}>
        Bodyn computes zones as % of max HR today. Edit the bands below for a custom split — heart-rate-reserve zones aren't implemented yet.
      </AppText>
      <Card style={{ gap: space.md }}>
        <View style={styles.zoneBar}>
          {zoneColors.map((c, i) => (
            <View key={i} style={{ flex: 1, height: 6, backgroundColor: c }} />
          ))}
        </View>
        {[0, 1, 2, 3, 4].map((i) => {
          const lo = Math.round(edges[i] * hrMax);
          const hi = i < 4 ? Math.round(edges[i + 1] * hrMax) : null;
          return (
            <View key={i} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: zoneColors[i] }]} />
              <View style={{ flex: 1 }}>
                <AppText>Zone {i + 1}</AppText>
                <AppText variant="tiny" muted>
                  {i === 0 ? `<${hi} bpm` : i === 4 ? `≥${lo} bpm` : `${lo}–${hi} bpm`}
                </AppText>
              </View>
              {i < 4 ? (
                <Stepper
                  value={Math.round(bands[i] * 100)}
                  onChange={(v) => {
                    const next = [...bands] as ZoneBands;
                    next[i] = v / 100;
                    prefs.set({ zoneBands: next });
                  }}
                  min={i === 0 ? 30 : Math.round(bands[i - 1] * 100) + 1}
                  max={i === 3 ? 99 : Math.round(bands[i + 1] * 100) - 1}
                  step={1}
                  format={(v) => `${v}%`}
                />
              ) : null}
            </View>
          );
        })}
      </Card>
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  toggle: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 999, padding: 3 },
  toggleOpt: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  zoneBar: { flexDirection: 'row', borderRadius: 3, overflow: 'hidden', gap: 2 },
}));
