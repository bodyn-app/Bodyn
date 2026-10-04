import { Chip, AppText, Card, DetailScreen, SectionHeader } from '@/components/ui';
import { useUnitsPrefs } from '@/state/units-prefs';
import { space } from '@/theme';

const DISTANCE: { v: 'km' | 'mi'; label: string }[] = [{ v: 'km', label: 'Kilometres (km)' }, { v: 'mi', label: 'Miles (mi)' }];
const WEIGHT: { v: 'kg' | 'lb'; label: string }[] = [{ v: 'kg', label: 'Kilograms (kg)' }, { v: 'lb', label: 'Pounds (lb)' }];
const ENERGY: { v: 'kcal' | 'kJ'; label: string }[] = [{ v: 'kcal', label: 'Kilocalories (kcal)' }, { v: 'kJ', label: 'Kilojoules (kJ)' }];

/** Only the units Bodyn actually has data for — no temperature or water/volume fields exist in the data model. */
export default function PreferencesUnits() {
  const units = useUnitsPrefs();
  return (
    <DetailScreen title="Units">
      <SectionHeader title="Distance" />
      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {DISTANCE.map((o) => (
          <Chip key={o.v} label={o.label} active={units.distance === o.v} onPress={() => units.set({ distance: o.v })} />
        ))}
      </Card>

      <SectionHeader title="Weight" />
      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {WEIGHT.map((o) => (
          <Chip key={o.v} label={o.label} active={units.weight === o.v} onPress={() => units.set({ weight: o.v })} />
        ))}
      </Card>

      <SectionHeader title="Energy" />
      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {ENERGY.map((o) => (
          <Chip key={o.v} label={o.label} active={units.energy === o.v} onPress={() => units.set({ energy: o.v })} />
        ))}
      </Card>

      <AppText variant="tiny" muted style={{ marginTop: space.lg }}>
        Applies everywhere Bodyn shows a distance, weight or calorie figure.
      </AppText>
    </DetailScreen>
  );
}
