import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';

import { Welcome } from '@/components/welcome';
import { hasHealthData } from '@/health';
import { registerServiceWorker } from '@/lib/service-worker';
import { useWebChrome } from '@/lib/web-chrome';
import { useNotificationSetup } from '@/notifications/use-setup';
import { useDefaultTab } from '@/state/default-tab';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  useNotificationSetup();
  useWebChrome(colors.bg);
  const router = useRouter();
  const { tab, hydrated } = useDefaultTab();
  const opened = useRef(false);
  useEffect(registerServiceWorker, []);
  useEffect(() => {
    // send the app to the user's chosen default tab once, right after startup — not on every re-render or later change
    if (!hasHealthData || !hydrated || opened.current) return;
    opened.current = true;
    if (tab !== 'index') router.replace(`/(tabs)/${tab}` as never);
  }, [hydrated, tab, router]);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.bg, border: colors.border, primary: colors.lime, text: colors.text },
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/* nothing imported on this device yet: the only screen is the import. Importing reloads the app. */}
      {!hasHealthData ? (
        <Welcome />
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          {/* the coach chat slides up over the whole app. A plain full-screen page (not a native modal) so the safe areas stay correct */}
          <Stack.Screen name="coach" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        </Stack>
      )}
    </ThemeProvider>
  );
}
