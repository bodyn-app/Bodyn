import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

export const workoutLabel = (type: string) =>
  type
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace('Traditional Strength Training', 'Strength Training');

const ICONS: Record<string, IconName> = {
  Running: 'walk',
  Walking: 'walk',
  Cycling: 'bicycle',
  Swimming: 'water',
  TraditionalStrengthTraining: 'barbell',
  CrossTraining: 'fitness',
  CoreTraining: 'body',
  Rowing: 'boat',
  Soccer: 'football',
  Volleyball: 'basketball',
  Elliptical: 'fitness',
};
export const workoutIcon = (type: string): IconName => ICONS[type] ?? 'fitness';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return { dow: DOW[d.getUTCDay()], day: d.getUTCDate(), month: MONTH[d.getUTCMonth()] };
};

export const dowShort = (date: string) => parts(date).dow;
export const dayNum = (date: string) => String(parts(date).day);
/** "Today", "Yesterday" or "Mon, 14 Sep". */
export const dateLabel = (date: string, today: string) => {
  const diff = Math.round((Date.parse(today) - Date.parse(date)) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const p = parts(date);
  return `${p.dow}, ${p.day} ${p.month}`;
};
export const dateLong = (date: string) => {
  const p = parts(date);
  return `${p.dow}, ${p.day} ${p.month} ${date.slice(0, 4)}`;
};
export const clock = (stamp: string) => stamp.slice(11, 16);

const startSeconds = (stamp: string) => +stamp.slice(11, 13) * 3600 + +stamp.slice(14, 16) * 60 + +stamp.slice(17, 19);
/** Minute of day (fractional) at which a timestamp like "2026-09-20 02:51:31 +0300" happens. */
export const clockMinutes = (stamp: string) => startSeconds(stamp) / 60;
/** "HH:MM" for `relMin` minutes after `startStamp` (wraps past midnight). */
export const clockAt = (startStamp: string, relMin: number) => {
  const total = Math.floor((startSeconds(startStamp) + relMin * 60) / 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
/** Short duration: "45s", "12m", "1h 05m". */
export const shortDuration = (min: number) => {
  if (min < 1) return `${Math.max(1, Math.round(min * 60))}s`;
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};
