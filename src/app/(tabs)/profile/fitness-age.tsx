import { View } from 'react-native';

import { LineChart } from '@/components/charts';
import { bandColor, bandTone, deltaText } from '@/components/fitness-card';
import { FitnessOrb } from '@/components/fitness-orb';
import { MetricSlider } from '@/components/fitness-metric-card';
import { AppText, Card, DetailScreen, SectionHeader } from '@/components/ui';
import { health } from '@/health';
import { dateLong } from '@/lib/format';
import { fitnessTrendNow, metrics, type FitnessTrend } from '@/metrics';
import { makeStyles, space, useTheme } from '@/theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (m: string) => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`;
const TREND_TEXT: Record<FitnessTrend, string> = { improving: 'Improving', steady: 'Steady', declining: 'Declining' };

const TODAY = () => health.lastDay;

export default function FitnessAge() {
  const styles = useStyles();
  const { colors } = useTheme();
  const f = metrics.fitness();

  if (!f)
    return (
      <DetailScreen title="Fitness age">
        <Card>
          <AppText variant="small" muted>
            Fitness age is worked out from the VO2 max your Apple Watch estimates during outdoor walks, runs and hikes. There are no VO2 max readings yet.
          </AppText>
        </Card>
      </DetailScreen>
    );

  const tone = bandColor(colors, f.band);
  const trend = fitnessTrendNow();
  const date = TODAY();

  return (
    <DetailScreen title="Fitness age">
      <View style={{ alignItems: 'center', marginVertical: space.lg }}>
        <View style={styles.headerRow}>
          <View style={styles.sideStat}>
            <AppText variant="h3" style={{ color: tone, textAlign: 'center' }}>
              {deltaText(f.delta, f.band, false)}
            </AppText>
            <AppText variant="tiny" muted style={{ textAlign: 'center' }}>
              vs your real age
            </AppText>
          </View>

          <FitnessOrb size={200} tone={bandTone(f.band)}>
            <AppText variant="big" style={{ fontSize: 60, lineHeight: 66, color: '#fff' }}>
              {f.fitnessAge}
            </AppText>
            <AppText variant="tiny" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: 1 }}>
              FITNESS AGE
            </AppText>
          </FitnessOrb>

          <View style={styles.sideStat}>
            <AppText variant="h3" style={{ color: colors.text, textAlign: 'center' }}>
              {trend ? TREND_TEXT[trend] : '–'}
            </AppText>
            <AppText variant="tiny" muted style={{ textAlign: 'center' }}>
              fitness trend
            </AppText>
          </View>
        </View>

        <AppText variant="small" muted style={{ marginTop: space.md }}>
          Your age: {f.age}
        </AppText>
      </View>

      <SectionHeader title="Sleep" />
      <View style={{ gap: space.md }}>
        <MetricSlider metricKey="sleepConsistency" date={date} min={40} max={100} />
        <MetricSlider metricKey="sleepMin" date={date} min={240} max={600} label="Hours of sleep" />
      </View>

      <SectionHeader title="Training" />
      <View style={{ gap: space.md }}>
        <MetricSlider metricKey="hrZone13" date={date} min={0} max={180} weekly label="Time in zones 2–3" />
        <MetricSlider metricKey="hrZone45" date={date} min={0} max={120} weekly label="Time in zones 4–5" />
        <MetricSlider metricKey="strengthMin" date={date} min={0} max={240} weekly label="Strength activity time" />
        <MetricSlider metricKey="steps" date={date} min={0} max={16000} />
      </View>

      <SectionHeader title="Fitness" />
      <View style={{ gap: space.md }}>
        <MetricSlider metricKey="vo2" date={date} min={15} max={70} />
        <MetricSlider metricKey="rhr" date={date} min={40} max={80} />
        <MetricSlider metricKey="leanMass" date={date} min={60} max={90} />
      </View>

      <SectionHeader title="VO2 max over time" />
      <Card>
        <LineChart
          values={f.monthly.map((m) => m.vo2)}
          labels={f.monthly.map((m) => MONTHS[+m.month.slice(5, 7) - 1])}
          labelEvery={3}
          tips={f.monthly.map((m) => ({ title: monthLabel(m.month), value: m.vo2 == null ? 'No reading' : `${m.vo2.toFixed(1)} mL/kg/min` }))}
          highlight={f.monthly.length - 1}
          showScale
          height={170}
        />
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          Monthly average of {f.readings} readings. Touch the line to see a month.
        </AppText>
      </Card>

      <SectionHeader title="How it's calculated" />
      <Card>
        <AppText variant="small" muted>
          Fitness age is the age at which a typical person of your sex has the same VO2 max as you. Your VO2 max here is the middle value of your last three readings, which smooths out day-to-day noise. A higher VO2 max means a lower fitness age.
        </AppText>
        <AppText variant="small" muted style={{ marginTop: space.sm }}>
          The comparison uses published median values from a large US treadmill-testing registry: 48.0 mL/kg/min for men aged 20–29 falling to 24.4 at 70–79, and 37.6 falling to 18.3 for women. Bodyn joins those with a straight line, so the result is an estimate rather than an exact figure.
        </AppText>
        <AppText variant="small" muted style={{ marginTop: space.sm }}>
          The colour follows how far apart the two ages are: green when your fitness age is more than 9 months younger, red when it's more than 9 months older, and blue in between — a wide enough band that day-to-day noise doesn't flip the colour.
        </AppText>
        <AppText variant="small" muted style={{ marginTop: space.sm }}>
          Each card under Sleep, Training and Fitness compares your last 30 days with your own longer-term average and shows a small, capped "years" estimate of which way it's pulling. That figure is Bodyn's own illustration, kept separate from the headline number above, not a validated multi-factor formula.
        </AppText>
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          VO2 max is estimated by your Apple Watch from outdoor walks, runs and hikes. It isn&apos;t a lab test and isn&apos;t medical advice.
        </AppText>
      </Card>
      <AppText variant="tiny" muted style={{ textAlign: 'center', marginTop: space.sm }}>
        Last VO2 max reading: {dateLong(f.latestDate)}
      </AppText>
    </DetailScreen>
  );
}

const useStyles = makeStyles(() => ({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
  sideStat: { width: 74, alignItems: 'center' },
}));
