import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { View } from 'react-native';

import { health } from '@/health';
import { metrics, type RecoveryBand } from '@/metrics';
import { type RingId, useRingOrder } from '@/state/ring-order';
import { type Colors, makeStyles, space, useTheme } from '@/theme';

import { Ring } from './charts';
import { AppText, fmtDuration } from './ui';

export const bandColor = (c: Colors, band: RecoveryBand) => (band === 'green' ? c.good : band === 'yellow' ? c.warn : c.bad);
export const bandName = (band: RecoveryBand) => (band === 'green' ? 'Well recovered' : band === 'yellow' ? 'Moderate' : 'Low');
export const sleepColor = (c: Colors) => c.rem;
export const strainColor = (c: Colors) => c.core;

/** Pass onPress to make the ring tappable; without it (the layout preview in Preferences) it is inert. */
function ScoreItem({ title, sub, subColor, progress, ringColor, onPress, children }: { title: string; sub: string; subColor: string; progress: number | null; ringColor: string; onPress?: () => void; children: ReactNode }) {
  const styles = useStyles();
  const body = (
    <>
      <Ring size={84} stroke={8} progress={progress} color={ringColor}>
        {children}
      </Ring>
      <AppText variant="h3" style={{ marginTop: 8 }}>
        {title}
      </AppText>
      <AppText variant="tiny" style={{ color: subColor }} numberOfLines={1}>
        {sub}
      </AppText>
    </>
  );
  if (!onPress) return <View style={styles.item}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}>
      {body}
    </Pressable>
  );
}

const Value = ({ text, unit }: { text: string; unit?: string }) => (
  <AppText variant="h1" style={{ fontSize: 22 }}>
    {text}
    {unit ? (
      <AppText variant="tiny" muted>
        {unit}
      </AppText>
    ) : null}
  </AppText>
);

type RingDef = { title: string; sub: string; subColor: string; progress: number | null; ringColor: string; route: string; value: ReactNode };

/** Everything the three rings need for one day, keyed by ring — so the row can be rendered in any order. */
function ringDefs(date: string, colors: Colors): Record<RingId, RingDef> {
  const rec = metrics.recovery(date);
  const sleep = metrics.sleep(date);
  const strain = metrics.strain(date);
  const asleepMin = health.getDay(date)?.sleep?.asleepMin;
  return {
    recovery: {
      title: 'Recovery',
      sub: rec ? bandName(rec.band) : 'No data',
      subColor: rec ? bandColor(colors, rec.band) : colors.textMuted,
      progress: rec ? rec.score / 100 : null,
      ringColor: rec ? bandColor(colors, rec.band) : colors.textDim,
      route: '/recovery',
      value: <Value text={rec ? String(rec.score) : '–'} unit={rec ? '%' : undefined} />,
    },
    sleep: {
      title: 'Sleep',
      sub: sleep ? fmtDuration(asleepMin) : 'No data',
      subColor: sleep ? sleepColor(colors) : colors.textMuted,
      progress: sleep ? sleep.score / 100 : null,
      ringColor: sleepColor(colors),
      route: '/sleep-detail',
      value: <Value text={sleep ? String(sleep.score) : '–'} unit={sleep ? '%' : undefined} />,
    },
    strain: {
      title: 'Strain',
      sub: strain ? `${strain.label} · of 21` : 'No data',
      subColor: strain ? strainColor(colors) : colors.textMuted,
      progress: strain ? strain.strain / 21 : null,
      ringColor: strainColor(colors),
      route: '/strain',
      value: <Value text={strain ? strain.strain.toFixed(1) : '–'} />,
    },
  };
}

/** The three headline widgets: Recovery %, Sleep %, Strain /21 — just the rings, no boxes. Their order is the user's (Preferences → UI Customization). */
export function ScoreRings({ date, preview }: { date: string; preview?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const order = useRingOrder((s) => s.order);
  const defs = ringDefs(date, colors);

  return (
    // the top spacing belongs to the home screen's rhythm; a preview sits inside a card and provides its own
    <View style={[styles.row, preview && { marginTop: 0 }]}>
      {order.map((id) => {
        const d = defs[id];
        return (
          <ScoreItem key={id} title={d.title} sub={d.sub} subColor={d.subColor} progress={d.progress} ringColor={d.ringColor} onPress={preview ? undefined : () => router.push(d.route as never)}>
            {d.value}
          </ScoreItem>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', justifyContent: 'space-around', marginTop: space.xl },
  item: { flex: 1, alignItems: 'center' },
}));
