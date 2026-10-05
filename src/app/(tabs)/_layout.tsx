import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? on : off} size={24} color={color} />;
  };

export default function TabsLayout() {
  const { colors } = useTheme();
  // In the home-screen web app the tab bar reaches the bottom edge, so it grows by the home-indicator inset to
  // keep the labels clear of it. Native keeps its tuned fixed height.
  const { bottom } = useSafeAreaInsets();
  const extra = Platform.OS === 'web' ? Math.max(0, bottom - 10) : 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.limeText,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 74 + extra, paddingTop: 8, paddingBottom: 10 + extra },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('stats-chart', 'stats-chart-outline') }} />
      <Tabs.Screen name="sleep" options={{ title: 'Sleep', tabBarIcon: icon('moon', 'moon-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Account', tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
  );
}
