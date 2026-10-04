import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppText, Card, DetailScreen } from '@/components/ui';
import { useTheme } from '@/theme';

const ROWS: { icon: keyof typeof Ionicons.glyphMap; title: string; hint: string; route: string }[] = [
  { icon: 'color-palette-outline', title: 'UI Customization', hint: 'Appearance, units, default tab, home layout', route: '/profile/preferences-ui' },
  { icon: 'heart-outline', title: 'Health Preferences', hint: 'Sleep goal, heart rate, training status', route: '/profile/preferences-health' },
  { icon: 'notifications-outline', title: 'Notifications', hint: 'What Bodyn sends you, and when', route: '/profile/notification-settings' },
];

/** Preferences hub, reached from the Account tab. */
export default function Preferences() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <DetailScreen title="Preferences">
      <View style={{ gap: 12 }}>
        {ROWS.map((r) => (
          <Card key={r.route} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} onPress={() => router.push(r.route as never)}>
            <Ionicons name={r.icon} size={20} color={colors.limeText} />
            <View style={{ flex: 1 }}>
              <AppText variant="h3">{r.title}</AppText>
              <AppText variant="small" muted>
                {r.hint}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Card>
        ))}
      </View>
    </DetailScreen>
  );
}
