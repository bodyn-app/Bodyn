import { View } from 'react-native';

import { LineChart, LevelBars, Ring } from '@/components/charts';
import { levelColor, stressBars } from '@/components/stress-card';
import { AppText, Card, DetailScreen, fmtNum, SectionHeader } from '@/components/ui';
import { dateLong, dowShort } from '@/lib/format';
import { trendSeries, trendTips } from '@/lib/trends';
import { metrics, stressLabel, type StressHour } from '@/metrics';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, space, useTheme } from '@/theme';

const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;

function hourTip(h: StressHour) {
  const title = `${hh(h.hour)} – ${hh(h.hour + 1)}`;
  if (h.state === 'asleep') return { title, value: 'Asleep' };
  if (h.state === 'nodata') return { title, value: 'No data' };
  if (h.state === 'active') return { title, value: `Active · ${fmtNum(h.hr)} bpm` };
  return { title, value: `${h.level!.toFixed(1)} · ${stressLabel(h.level!)} · ${fmtNum(h.hr)} bpm` };
}

export default function Stress() {
  const styles = useStyles();
  const { colors } = useTheme();
  const date = useSelectedDate((s) => s.date);
  const s = metrics.stress(date);
  const trend = trendSeries('stress', date, 14);
  const peak = s ? s.hours.reduce<StressHour | null>((b, h) => (h.level != null && (b == null || h.level > (b.level ?? -1)) ? h : b), null) : null;

  return (
    <DetailScreen title="Stress">
      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        {dateLong(date)}
      </AppText>

      <View style={{ alignItems: 'center', marginVertical: space.lg }}>
        <Ring size={168} stroke={14} progress={s ? s.level / 3 : null} color={s ? levelColor(colors, s.level) : colors.textDim}>
          <AppText variant="big" style={{ fontSize: 44 }}>
            {s ? s.level.toFixed(1) : '–'}
          </AppText>
          <AppText variant="tiny" muted>
            out of 3
          </AppText>
        </Ring>
        <AppText variant="h3" style={{ marginTop: space.md, color: s ? levelColor(colors, s.level) : colors.textMuted }}>
          {s ? `${s.label} stress` : 'Not enough data'}
        </AppText>
      </View>

      {s ? (
        <>
          <View style={styles.grid}>
            <Fact label="High-stress hours" value={String(s.highHours)} />
            <Fact label="Hours analysed" value={String(s.awakeHours)} />
          </View>
          <View style={[styles.grid, { marginTop: space.md }]}>
            <Fact label="Your usual daytime HR" value={`${Math.round(s.baselineHr)} ± ${Math.round(s.baselineSd)} bpm`} />
            <Fact label="Most stressed hour" value={peak ? `${hh(peak.hour)} · ${peak.level!.toFixed(1)}` : '–'} />
          </View>

          <SectionHeader title="Hour by hour" />
          <Card>
            <LevelBars
              bars={stressBars(colors, s.hours)}
              labels={s.hours.map((h) => String(h.hour).padStart(2, '0'))}
              tips={s.hours.map(hourTip)}
              height={150}
              showScale
              format={(v) => String(Math.round(v))}
            />
            <View style={styles.legend}>
              <Key color={colors.good} label="Low" />
              <Key color={colors.warn} label="Moderate" />
              <Key color={colors.bad} label="High" />
              <Key color={colors.barIdle} label="Asleep" />
              <Key color={colors.rest} label="Active" />
            </View>
            <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
              Touch a bar to see that hour. Hours when you were asleep, moving or exercising aren&apos;t scored.
            </AppText>
          </Card>
        </>
      ) : (
        <Card>
          <AppText variant="small" muted>
            Stress compares your heart rate while awake and still with your own last 30 days. It needs about a month of Watch heart-rate data and at least 3 awake, inactive hours on the day.
          </AppText>
        </Card>
      )}

      <SectionHeader title="Last 14 days" />
      <Card>
        <LineChart
          values={trend.values}
          labels={trend.dates.map((d) => dowShort(d).slice(0, 1))}
          tips={trendTips('stress', trend)}
          highlight={13}
          showScale
          height={150}
          zeroBase
        />
      </Card>

      <SectionHeader title="How it's calculated" />
      <Card>
        <AppText variant="small" muted>
          Each hour when you were awake and not moving is compared with your usual heart rate for those quiet hours over the past 30 days. The further above your usual, the higher the stress: under 1 is Low, 1 to 2 is Moderate, and 2 or more is High. Your daily number is the average of those hours.
        </AppText>
        <AppText variant="small" muted style={{ marginTop: space.sm }}>
          Sleeping, walking and workouts are left out so that movement isn&apos;t mistaken for stress. Coffee, illness, poor sleep and hot weather can also raise it.
        </AppText>
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          Bodyn&apos;s own estimate from heart rate. It isn&apos;t a medical measurement.
        </AppText>
      </Card>
    </DetailScreen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, gap: 4 }}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <AppText variant="h3">{value}</AppText>
    </Card>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <AppText variant="tiny" muted>
        {label}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  grid: { flexDirection: 'row', gap: space.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.md },
}));
