import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { coach, type Tone } from '@/coach';
import { type Colors, space, useTheme } from '@/theme';

import { AppText, Card } from './ui';

export const toneColor = (c: Colors, tone: Tone) => (tone === 'good' ? c.good : tone === 'warn' ? c.warn : tone === 'bad' ? c.bad : tone === 'info' ? c.core : c.textMuted);

/** Coach's call for the selected day: train hard, train smart, take it easy, walk, rest or sleep. Tap for the plan, or "Ask your coach" for the chat. */
export function GuidanceCard({ date }: { date: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const a = coach.advice(date);
  const tone = toneColor(colors, a.tone);

  return (
    <Card style={{ marginTop: space.lg, gap: space.md }} onPress={() => router.push('/coach-plan')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={a.icon} size={20} color={tone} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="tiny" style={{ color: tone, fontWeight: '700', letterSpacing: 0.6 }}>
            {a.title.toUpperCase()}
          </AppText>
          <AppText variant="h3">{a.headline}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </View>

      <AppText variant="small" muted numberOfLines={3}>
        {a.body}
      </AppText>

      {a.actions.slice(0, 2).map((t) => (
        <View key={t} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone, marginTop: 6 }} />
          <AppText variant="small" style={{ flex: 1 }}>
            {t}
          </AppText>
        </View>
      ))}

      <Pressable onPress={() => router.push('/coach')} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }} accessibilityLabel="Ask your coach">
        <Ionicons name="sparkles" size={13} color={colors.limeText} />
        <AppText variant="small" lime style={{ fontWeight: '600' }}>
          Ask your coach
        </AppText>
      </Pressable>
    </Card>
  );
}
