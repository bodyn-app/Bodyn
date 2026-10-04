import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { DistanceUnit, EnergyUnit, WeightUnit } from '@/lib/units';

const KEY = 'bodyn.units';

type State = {
  distance: DistanceUnit;
  weight: WeightUnit;
  energy: EnergyUnit;
  set: (patch: Partial<Pick<State, 'distance' | 'weight' | 'energy'>>) => void;
};

export const useUnitsPrefs = create<State>((set) => ({
  distance: 'km',
  weight: 'kg',
  energy: 'kcal',
  set: (patch) => set(patch),
}));

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (!v) return;
    const saved = JSON.parse(v) as Partial<State>;
    useUnitsPrefs.setState(saved);
  })
  .catch(() => {})
  .finally(() => {
    useUnitsPrefs.subscribe((s) => {
      AsyncStorage.setItem(KEY, JSON.stringify({ distance: s.distance, weight: s.weight, energy: s.energy })).catch(() => {});
    });
  });
