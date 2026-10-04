// Unit conversion for user-facing display only — all stored/computed data stays metric (km, kg, kcal).
export type DistanceUnit = 'km' | 'mi';
export type WeightUnit = 'kg' | 'lb';
export type EnergyUnit = 'kcal' | 'kJ';

const KM_TO_MI = 0.621371;
const KG_TO_LB = 2.204623;
const KCAL_TO_KJ = 4.184;

export const convertDistance = (km: number, unit: DistanceUnit) => (unit === 'mi' ? km * KM_TO_MI : km);
export const convertWeight = (kg: number, unit: WeightUnit) => (unit === 'lb' ? kg * KG_TO_LB : kg);
export const convertEnergy = (kcal: number, unit: EnergyUnit) => (unit === 'kJ' ? kcal * KCAL_TO_KJ : kcal);

export const distanceLabel = (unit: DistanceUnit) => (unit === 'mi' ? 'mi' : 'km');
export const weightLabel = (unit: WeightUnit) => (unit === 'lb' ? 'lb' : 'kg');
export const energyLabel = (unit: EnergyUnit) => (unit === 'kJ' ? 'kJ' : 'kcal');

/** Distance is usually shown with 2 decimals in km but reads better with 1 in miles. */
export const distanceDecimals = (unit: DistanceUnit) => (unit === 'mi' ? 1 : 2);
