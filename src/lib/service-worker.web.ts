/** Registers public/sw.js so the home-screen app opens without a network. Production builds only (it would cache dev bundles). */
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
  navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {});
}
