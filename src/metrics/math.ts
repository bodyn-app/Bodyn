// Small numeric helpers shared by the metric engines.
export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
export const sd = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
export const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};
/** Standard normal CDF (Abramowitz–Stegun 7.1.26). */
export function normCdf(z: number) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
}
