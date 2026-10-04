import { SleepBody } from '@/components/sleep-view';
import { AppText, DetailScreen } from '@/components/ui';
import { dateLong } from '@/lib/format';
import { useSelectedDate } from '@/state/selected-date';

export default function SleepDetail() {
  const date = useSelectedDate((s) => s.date);
  return (
    <DetailScreen title="Sleep">
      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        {dateLong(date)} · shown on the day you woke up
      </AppText>
      <SleepBody date={date} />
    </DetailScreen>
  );
}
