import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PillBars, Ring } from '@/components/charts';
import { strainColor } from '@/components/score-rings';
import { AppText, Card, DetailScreen, fmtDuration, fmtNum, SectionHeader } from '@/components/ui';
import { addDays, health } from '@/health';
import { dateLabel, dateLong, dowShort, workoutLabel } from '@/lib/format';
import { metrics, targetStrain } from '@/metrics';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, space, useTheme, type Colors } from '@/theme';

const zonesOf = (colors: Colors) => [
  { label: 'Zone 1 · Very light', sub: 'under 60% of max', color: colors.rest },
  { label: 'Zone 2 · Light', sub: '60–70%', color: colors.good },
  { label: 'Zone 3 · Moderate', sub: '70–80%', color: colors.warn },
  { label: 'Zone 4 · Hard', sub: '80–90%', color: colors.awake },
  { label: 'Zone 5 · Maximum', sub: 'over 90%', color: colors.bad },
];

export default function Strain() {
  const styles = useStyles();
  const { colors } = useTheme();
  const ZONES = zonesOf(colors);
  const router = useRouter();
  const date = useSelectedDate((s) => s.date);
  const st = metrics.strain(date);
  const rec = metrics.recovery(date);
  const workouts = health.getWorkouts(date, date);
  const all = health.getWorkouts();
  const days = Array.from({ length: 14 }, (_, i) => addDays(date, i - 13));
  // Zone 1 includes all resting/sleeping hours, so scale bars against Zones 2–5 (Zone 1 is capped at full)
  const zoneMax = Math.max(...(st?.zones.slice(1) ?? [1]), 1);

  return (
    <DetailScreen title="Strain">
      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        {dateLong(date)}
      </AppText>

      <View style={{ alignItems: 'center', marginVertical: space.lg }}>
        <Ring size={168} stroke={14} progress={st ? st.strain / 21 : null} color={strainColor(colors)}>
          <AppText variant="big" style={{ fontSize: 44 }}>
            {st ? st.strain.toFixed(1) : '–'}
          </AppText>
          <AppText variant="tiny" muted>
            out of 21
          </AppText>
        </Ring>
        <AppText variant="h3" style={{ marginTop: space.md, color: st ? strainColor(colors) : colors.textMuted }}>
          {st ? `${st.label} day` : 'No heart-rate data'}
        </AppText>
      </View>

      {st ? (
        <>
          {rec ? (
            <Card style={{ marginBottom: space.md }}>
              <AppText variant="small" muted>
                Recovery is {rec.score}% ({rec.band}) — the suggested strain is{' '}
                <AppText variant="small" style={{ color: colors.text, fontWeight: '700' }}>
                  {targetStrain(rec.band)[0]}–{targetStrain(rec.band)[1]}
                </AppText>
                . {st.strain < targetStrain(rec.band)[0] ? 'Room to push harder.' : st.strain > targetStrain(rec.band)[1] ? 'Above the suggestion — prioritise sleep tonight.' : 'Right in the target range.'}
              </AppText>
            </Card>
          ) : null}

          <SectionHeader title="Time in heart-rate zones" />
          <Card style={{ gap: space.md }}>
            {ZONES.map((z, i) => (
              <View key={z.label} style={{ gap: 4 }}>
                <View style={styles.row}>
                  <AppText variant="small" style={{ flex: 1 }}>
                    {z.label} <AppText variant="tiny" muted>{z.sub}</AppText>
                  </AppText>
                  <AppText variant="small" muted>
                    {fmtDuration(Math.round(st.zones[i]))}
                  </AppText>
                </View>
                <View style={styles.track}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: z.color, width: `${Math.min(1, st.zones[i] / zoneMax) * 100}%` }} />
                </View>
              </View>
            ))}
            <AppText variant="tiny" muted>
              Resting HR {fmtNum(st.hrRest)} bpm · max HR {fmtNum(st.hrMax)} bpm
            </AppText>
          </Card>
        </>
      ) : null}

      {workouts.length ? (
        <>
          <SectionHeader title="Workouts that day" />
          <View style={{ gap: space.sm }}>
            {workouts.map((w) => (
              <Card key={w.start} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(all.indexOf(w)) } })} style={styles.wRow}>
                <AppText variant="h3" style={{ flex: 1 }}>
                  {workoutLabel(w.type)}
                </AppText>
                <AppText variant="small" muted>
                  {fmtDuration(w.durationMin)} · avg {fmtNum(w.hrAvg)} bpm
                </AppText>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      <SectionHeader title="Last 14 days" />
      <Card>
        <PillBars
          values={days.map((d) => metrics.strain(d)?.strain ?? 0)}
          labels={days.map((d) => dowShort(d).slice(0, 1))}
          height={140}
          highlight={13}
          tips={days.map((d) => { const x = metrics.strain(d); return { title: dateLabel(d, health.lastDay), value: x ? `${x.strain.toFixed(1)} · ${x.label}` : 'No data' }; })}
          showScale
          format={(v) => String(Math.round(v))}
          goal={rec ? targetStrain(rec.band)[0] : undefined}
        />
        {rec ? (
          <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
            Dashed line = lower end of today&apos;s suggested strain.
          </AppText>
        ) : null}
      </Card>

      <SectionHeader title="How it's calculated" />
      <Card>
        <AppText variant="small" muted>
          Every minute of heart rate above your resting level is weighted by how hard it was, using the Banister TRIMP formula on your heart-rate reserve (resting HR to max HR). The total load is then put on a logarithmic 0–21 scale, so going from 10 to 14 takes much more effort than going from 2 to 6. Yesterday&apos;s strain also raises tonight&apos;s sleep need.
        </AppText>
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          Bodyn&apos;s own scoring model, calibrated to your data (rest days ≈ 2–6, workout days ≈ 8–14).
        </AppText>
      </Card>
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.barIdle, overflow: 'hidden' },
  wRow: { flexDirection: 'row', alignItems: 'center', padding: space.md },
}));
