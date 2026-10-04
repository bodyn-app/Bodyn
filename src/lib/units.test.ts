import { describe, expect, it } from 'vitest';

import { convertDistance, convertEnergy, convertWeight, distanceLabel, energyLabel, weightLabel } from './units';

describe('unit conversion', () => {
  it('distance: km passes through, mi converts', () => {
    expect(convertDistance(10, 'km')).toBe(10);
    expect(convertDistance(10, 'mi')).toBeCloseTo(6.21371, 4);
  });
  it('weight: kg passes through, lb converts', () => {
    expect(convertWeight(80, 'kg')).toBe(80);
    expect(convertWeight(80, 'lb')).toBeCloseTo(176.37, 1);
  });
  it('energy: kcal passes through, kJ converts', () => {
    expect(convertEnergy(500, 'kcal')).toBe(500);
    expect(convertEnergy(500, 'kJ')).toBeCloseTo(2092, 0);
  });
  it('labels match the unit', () => {
    expect(distanceLabel('mi')).toBe('mi');
    expect(weightLabel('lb')).toBe('lb');
    expect(energyLabel('kJ')).toBe('kJ');
  });
});
