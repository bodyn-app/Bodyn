import { StyleSheet, View } from 'react-native';

import { LineChart, Ring } from '@/components/charts';
import { bandColor, bandName } from '@/components/score-rings';
import { AppText, Card, DetailScreen, fmtNum, SectionHeader } from '@/components/ui';
import { health } from '@/health';
import { dateLong, dowShort } from '@/lib/format';
import { metrics, targetStrain, type Contributor } from '@/metrics';
import { trendSeries, trendTips } from '@/lib/trends';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, space, useTheme } from '@/theme';

export default function Recovery() {
  const { colors } = useTheme();
  const date = useSelectedDate((s) => s.date);
  const rec = metrics.recovery(date);
  const strain = metrics.strain(date);
  const week = trendSeries('recovery', date, 14);

  return (
    <DetailScreen title="Recovery">
      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        {dateLong(date)}
      </AppText>

      <View style={{ alignItems: 'center', marginVertical: space.lg }}>
        <Ring size={168} stroke={14} progress={rec ? rec.score / 100 : null} color={rec ? bandColor(colors, rec.band) : colors.textDim}>
          <AppText variant="big" style={{ fontSize: 44 }}>
            {rec ? rec.score : '–'}
            <AppText variant="small" muted>
              {rec ? '%' : ''}
            </AppText>
          </AppText>
        </Ring>
        <AppText variant="h3" style={{ marginTop: space.md, color: rec ? bandColor(colors, rec.band) : colors.textMuted }}>
          {rec ? bandName(rec.band) : 'Not enough data yet'}
        </AppText>
      </View>

      {rec ? (
        <>
          <SectionHeader title="What drives it" />
          <Card style={{ gap: space.lg }}>
            {rec.contributors.map((c) => (
              <ContributorRow key={c.key} c={c} />
            ))}
          </Card>

          <SectionHeader title="Today's target strain" />
          <TargetCard band={rec.band} current={strain?.strain ?? null} />
        </>
      ) : (
        <Card>
          <AppText variant="small" muted>
            Recovery compares your overnight HRV and resting heart rate with your own last 30 days. It needs at least 5 previous days of Watch data and an HRV or resting-heart-rate reading for this day.
          </AppText>
        </Card>
      )}

      <SectionHeader title="Last 14 days" />
      <Card>
        <LineChart
          values={week.values}
          labels={week.dates.map((d) => dowShort(d).slice(0, 1))}
          highlight={13}
          tips={trendTips('recovery', week)}
          showScale
          format={(v) => `${Math.round(v)}`}
          height={150}
        />
      </Card>

      <SectionHeader title="How it's calculated" />
      <Card>
        <AppText variant="small" muted>
          Each signal is compared with your own 30-day baseline as a z-score (how many standard deviations better or worse than usual): HRV 50%, resting heart rate 25%, respiratory rate 10% and last night&apos;s sleep score 15%. The combined score is turned into a 0–100% with a normal curve, so an average day lands around 55%. Green is 67% and up, yellow 34–66%, red below 34%.
        </AppText>
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          Bodyn&apos;s own scoring model, built around your personal baseline. HRV comes from Apple Health as SDNN. Apple records only a handful of
          HRV readings a night, so any single reading more than double (or less than half) your own typical value is reined in to that limit before
          scoring — a real change still shows, but one stray measurement can&apos;t decide your day.
        </AppText>
      </Card>
      <View style={{ height: space.lg }} />
      <AppText variant="tiny" muted style={{ textAlign: 'center' }}>
        {health.firstDay} → {health.lastDay}
      </AppText>
    </DetailScreen>
  );
}

function ContributorRow({ c }: { c: Contributor }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const good = c.z >= 0;
  const pct = Math.min(1, Math.abs(c.z) / 3);
  const diff = c.baseline ? ((c.value - c.baseline) / c.baseline) * 100 : null;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.row}>
        <AppText variant="h3" style={{ flex: 1 }}>
          {c.label}
        </AppText>
        <AppText variant="h3">
          {c.key === 'resp' ? fmtNum(c.value, 1) : fmtNum(c.value)}{' '}
          <AppText variant="small" muted>
            {c.unit}
          </AppText>
        </AppText>
      </View>
      {/* centered bar: right = better than usual, left = worse */}
      <View style={styles.track}>
        <View style={styles.mid} />
        <View
          style={[
            styles.fill,
            { backgroundColor: good ? colors.good : colors.bad, width: `${pct * 50}%` },
            good ? { left: '50%' } : { right: '50%' },
          ]}
        />
      </View>
      <AppText variant="tiny" muted>
        {c.baseline != null
          ? `30-day typical ${c.key === 'resp' ? fmtNum(c.baseline, 1) : fmtNum(c.baseline)} ${c.unit}${diff != null ? ` · ${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%` : ''} · ${good ? 'better' : 'worse'} than usual`
          : `Reference 75 · ${good ? 'above' : 'below'} typical`}{' '}
        · weight {Math.round(c.weight * 100)}%
      </AppText>
      {c.capped != null ? (
        <AppText variant="tiny" style={{ color: colors.warn }}>
          A reading this far from your usual is treated as {fmtNum(c.capped, 1)} {c.unit} for scoring, so one odd measurement can&apos;t swing your recovery.
        </AppText>
      ) : null}
    </View>
  );
}

function TargetCard({ band, current }: { band: 'red' | 'yellow' | 'green'; current: number | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [lo, hi] = targetStrain(band);
  return (
    <Card style={{ gap: space.md }}>
      <AppText variant="small" muted>
        Your recovery suggests a strain of{' '}
        <AppText variant="small" style={{ color: colors.text, fontWeight: '700' }}>
          {lo}–{hi}
        </AppText>{' '}
        today{current != null ? ` — so far ${current.toFixed(1)}` : ''}.
      </AppText>
      <View style={styles.trackWide}>
        <View style={{ position: 'absolute', left: `${(lo / 21) * 100}%`, width: `${((hi - lo) / 21) * 100}%`, top: 0, bottom: 0, backgroundColor: colors.limeDim, borderRadius: 5 }} />
        {current != null ? <View style={{ position: 'absolute', left: `${Math.min(current / 21, 1) * 100}%`, top: -3, bottom: -3, width: 3, borderRadius: 2, backgroundColor: colors.text }} /> : null}
      </View>
      <View style={styles.row}>
        <AppText variant="tiny" muted style={{ flex: 1 }}>
          0
        </AppText>
        <AppText variant="tiny" muted>
          21
        </AppText>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.barIdle, overflow: 'hidden' },
  mid: { position: 'absolute', left: '50%', width: 2, top: 0, bottom: 0, backgroundColor: colors.textDim, zIndex: 2 },
  fill: { position: 'absolute', top: 0, bottom: 0 },
  trackWide: { height: 10, borderRadius: 5, backgroundColor: colors.barIdle },
}));
