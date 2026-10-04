import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayStrip } from '@/components/day-strip';
import { WIDGETS } from '@/components/home-widgets';
import { ScoreRings } from '@/components/score-rings';
import { AppText } from '@/components/ui';
import { useUnread } from '@/notifications/use-unread';
import { firstName, useUserName } from '@/state/user-name';
import { isHalf, packRows, useHomeLayout, visibleWidgets, type WidgetId } from '@/state/home-layout';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, space, useTheme } from '@/theme';

export default function Home() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const unread = useUnread();
  const name = firstName(useUserName((s) => s.name));
  const date = useSelectedDate((s) => s.date);
  const { order, hidden } = useHomeLayout();
  const rows = packRows(visibleWidgets(order, hidden));

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            {name ? (
              <AppText variant="h3" style={{ color: colors.onLime }}>
                {name[0].toUpperCase()}
              </AppText>
            ) : (
              <Ionicons name="person" size={18} color={colors.onLime} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="small" muted>
              Welcome back
            </AppText>
            <AppText variant="h2">{name ? `Hi, ${name}!` : 'Hi there!'}</AppText>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={styles.bell} accessibilityLabel="Open notifications" hitSlop={8}>
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <AppText variant="tiny" style={{ color: '#fff', fontWeight: '700' }}>
                  {unread > 9 ? '9+' : unread}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* fixed: the date strip and the score rings are not part of the customisable layout */}
        <DayStrip />

        <ScoreRings date={date} />

        {/* everything below is the user's own layout (Preferences → UI Customization → Home Layout) */}
        {rows.map((row) => (
          <WidgetRow key={row.join('+')} row={row} date={date} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

/** One row of the layout: a full-width widget on its own, or a pair of half-width tiles side by side. */
function WidgetRow({ row, date }: { row: WidgetId[]; date: string }) {
  const styles = useStyles();
  // full-width widgets carry their own top spacing; the half-width tile row provides its own
  if (row.length === 1 && !isHalf(row[0])) {
    const { Component } = WIDGETS[row[0]];
    return <Component date={date} />;
  }
  return (
    <View style={[styles.grid, { marginTop: space.md }]}>
      {row.map((id) => {
        const { Component } = WIDGETS[id];
        return <Component key={id} date={date} />;
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.bad, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', gap: space.md },
}));
