import { useEffect } from 'react';

/**
 * Keeps the browser's own surfaces in the app's theme: the page background (seen during overscroll and while
 * loading) and theme-color, which iOS uses for the status bar strip of the home-screen app. Follows the in-app
 * Appearance choice, which can differ from the phone's light/dark setting that index.html starts from.
 */
export function useWebChrome(bg: string) {
  useEffect(() => {
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
    metas.forEach((m) => {
      m.removeAttribute('media'); // one colour for both appearances, the app's current one
      m.content = bg;
    });
  }, [bg]);
}
