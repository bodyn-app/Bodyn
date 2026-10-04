import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { addDays, health } from '@/health';
import { clock, clockMinutes, dateLabel, dowShort } from '@/lib/format';
import { metrics } from '@/metrics';
import { makeStyles, space, useTheme } from '@/theme';

import { Hypnogram, PillBars, Ring } from './charts';
import { sleepColor } from './score-rings';
import { AppText, Card, fmtDuration, fmtNum, SectionHeader } from './ui';

/** Everything about one night: score, stages, vitals, last 7 nights, and how the score works. Used by the Sleep tab and the Sleep detail page. */
export function SleepBody({ date }: { date: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const day = health.getDay(date);
  const s = day?.sleep;
  const o = day?.overnight;
  const score = metrics.sleep(date);
  const last7 = health.getRange(addDays(date, -6), date);
  const stages = [
    { key: 'awakeMin', label: 'Awake', color: colors.awake },
    { key: 'remMin', label: 'REM', color: colors.rem },
    { key: 'coreMin', label: 'Core', color: colors.core },
    { key: 'deepMin', label: 'Deep', color: colors.deep },
  ] as const;

  return (
    <>
      {!s || !score ? (
        <Card style={{ marginTop: space.lg, alignItems: 'center', gap: 6 }}>
          <Ionicons name="moon-outline" size={28} color={colors.textDim} />
          <AppText variant="h3">No sleep recorded</AppText>
          <AppText variant="small" muted style={{ textAlign: 'center' }}>
            Your Apple Watch didn&apos;t record sleep for this night. Pick another day above.
          </AppText>
        </Card>
      ) : (
        <>
          {/* score */}
          <Card style={{ marginTop: space.lg, gap: space.lg }}>
            <View style={styles.scoreTop}>
              <Ring size={110} stroke={10} progress={score.score / 100} color={sleepColor(colors)}>
                <AppText variant="h1" style={{ fontSize: 30 }}>
                  {score.score}
                  <AppText variant="tiny" muted>
                    %
                  </AppText>
                </AppText>
              </Ring>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="small" muted>
                  Time asleep
                </AppText>
                <AppText variant="h1" lime>
                  {fmtDuration(s.asleepMin)}
                </AppText>
                <AppText variant="small" muted>
                  {clock(s.start)} → {clock(s.end)}
                </AppText>
                <AppText variant="tiny" muted>
                  Sleep need: {fmtDuration(score.needMin)}
                </AppText>
              </View>
            </View>
            <View style={{ gap: space.md }}>
              {score.components.map((c) => (
                <View key={c.key} style={{ gap: 5 }}>
                  <View style={styles.legendHead}>
                    <AppText variant="small" style={{ flex: 1 }}>
                      {c.label}
                    </AppText>
                    <AppText variant="small" muted>
                      {c.score != null ? `${Math.round(c.score)}%` : '–'}
                    </AppText>
                  </View>
                  <View style={styles.track}>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: sleepColor(colors), width: `${c.score ?? 0}%` }} />
                  </View>
                  <AppText variant="tiny" muted>
                    {c.detail} · weight {Math.round(c.weight * 100)}%
                  </AppText>
                </View>
              ))}
            </View>
          </Card>

          {/* stages, tappable */}
          <SectionHeader title="Stages" action="Exact times" onAction={() => router.push('/sleep-stages')} />
          <Card onPress={() => router.push('/sleep-stages')}>
            <Hypnogram stages={s.stages} totalMin={s.stages[s.stages.length - 1][1]} startClockMin={clockMinutes(s.start)} />
            <View style={styles.legend}>
              {stages.map((st) => (
                <View key={st.key} style={{ flex: 1, gap: 2 }}>
                  <View style={styles.legendHead}>
                    <View style={[styles.dot, { backgroundColor: st.color }]} />
                    <AppText variant="tiny" muted>
                      {st.label}
                    </AppText>
                  </View>
                  <AppText variant="h3">{fmtDuration(s[st.key])}</AppText>
                </View>
              ))}
            </View>
            <AppText variant="tiny" muted style={{ marginTop: space.md }}>
              Tap for the exact time of every stage
            </AppText>
          </Card>

          <SectionHeader title="Overnight vitals" />
          <View style={styles.grid}>
            <Vital icon="pulse" label="HRV (SDNN)" value={fmtNum(o?.hrv, 0)} unit="ms" />
            <Vital icon="heart" label="Lowest HR" value={fmtNum(o?.hrMin)} unit="bpm" />
          </View>
          <View style={[styles.grid, { marginTop: space.md }]}>
            <Vital icon="cloud" label="Respiratory" value={fmtNum(o?.resp, 1)} unit="br/min" />
            <Vital icon="water" label="Blood oxygen" value={fmtNum(day?.spo2, 0)} unit="%" />
          </View>
        </>
      )}

      <SectionHeader title="Last 7 nights" />
      <Card>
        <PillBars
          values={last7.map((r) => (r.day?.sleep?.asleepMin ?? 0) / 60)}
          labels={last7.map((r) => dowShort(r.date))}
          tips={last7.map((r) => ({ title: dateLabel(r.date, health.lastDay), value: r.day?.sleep ? fmtDuration(r.day.sleep.asleepMin) : 'No data' }))}
          height={130}
          highlight={6}
          showScale
          format={(v) => `${Math.round(v * 10) / 10}h`}
        />
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          Hours asleep. Touch a bar to see the exact time. Small dots are nights without Watch sleep data.
        </AppText>
      </Card>

      <SectionHeader title="How it's calculated" />
      <Card>
        <AppText variant="small" muted>
          Your sleep score is out of 100 and combines four things: how long you slept compared with what you needed (50%), how much of your time in bed you were actually asleep (15%), how much of your sleep was deep and REM (20%), and how regular your bed and wake times are compared with the last week (15%).
        </AppText>
        <AppText variant="small" muted style={{ marginTop: space.sm }}>
          Your sleep need starts at 8 hours and grows by up to 30 minutes after a high-strain day. Sleep also feeds your recovery score the next morning.
        </AppText>
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          Bodyn&apos;s own scoring model, using the sleep stages recorded by your Apple Watch.
        </AppText>
      </Card>
    </>
  );
}

function Vital({ icon, label, value, unit }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; unit: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, gap: 6 }}>
      <View style={styles.legendHead}>
        <Ionicons name={icon} size={14} color={colors.lime} />
        <AppText variant="small" muted>
          {label}
        </AppText>
      </View>
      <AppText variant="h2">
        {value}{' '}
        <AppText variant="small" muted>
          {unit}
        </AppText>
      </AppText>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  scoreTop: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.barIdle, overflow: 'hidden' },
  grid: { flexDirection: 'row', gap: space.md },
  legend: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
}));
