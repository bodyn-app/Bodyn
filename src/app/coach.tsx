import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { coach } from '@/coach';
import { ChatDrawer } from '@/components/chat-drawer';
import { AppText } from '@/components/ui';
import { health } from '@/health';
import { dateLabel } from '@/lib/format';
import { useTopInset } from '@/lib/safe-top';
import { useCoachChats } from '@/state/coach-chats';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, radius, space, useTheme } from '@/theme';

/** The coach's "face": a soft glowing orb. */
function Orb() {
  const { colors } = useTheme();
  return (
    <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: colors.lime, opacity: 0.14 }} />
      <View style={{ position: 'absolute', width: 124, height: 124, borderRadius: 62, backgroundColor: colors.lime, opacity: 0.16 }} />
      <LinearGradient colors={['#D7FF7A', colors.lime, '#3E9B3E']} start={{ x: 0.25, y: 0.1 }} end={{ x: 0.8, y: 1 }} style={{ width: 96, height: 96, borderRadius: 48 }} />
      <View style={{ position: 'absolute', top: 36, left: 46, width: 14, height: 9, borderRadius: 5, backgroundColor: '#fff', opacity: 0.55 }} />
    </View>
  );
}

/** Full-screen chat with the coach. Chats are saved; the top-left button opens the history, the top-right X closes. */
export default function Coach() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const top = useTopInset();
  const date = useSelectedDate((s) => s.date);
  const scroll = useRef<ScrollView>(null);
  const { threads, activeId, hydrated, startNew, open, remove, ensure, append } = useCoachChats();
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [menu, setMenu] = useState(false);

  const prompts = useMemo(() => coach.quickPrompts(date), [date]);
  const thread = threads.find((t) => t.id === activeId) ?? null;
  // chats saved by an earlier version began with a stored greeting; the greeting is now the empty-chat screen
  const msgs = (thread?.messages ?? []).filter((m) => !m.greeting);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [msgs.length, typing, activeId]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    setInput('');
    setTyping(true);
    const id = ensure([]);
    const before = useCoachChats.getState().threads.find((t) => t.id === id)?.parsed ?? null;
    const now = Date.now();
    append(id, [{ id: now, from: 'me', text }]);
    // the reply call is async-ready: a future AI coach can replace it without changing this screen
    const { reply, parsed } = await Promise.resolve(coach.reply(text, date, before));
    await new Promise((r) => setTimeout(r, 450));
    append(id, [{ id: now + 1, from: 'coach', text: reply.text, bullets: reply.bullets, chips: reply.chips }], reply.kind === 'answer' ? parsed : before);
    setTyping(false);
  };

  if (!hydrated) return <View style={{ flex: 1 }} />;

  const chip = (c: string) => (
    <Pressable key={c} onPress={() => send(c)} style={styles.chip}>
      <AppText variant="small" style={{ color: colors.text }}>
        {c}
      </AppText>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, paddingTop: top }} edges={['bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Pressable onPress={() => setMenu(true)} hitSlop={12} style={styles.roundBtn} accessibilityLabel="Chat history">
              <Ionicons name="menu" size={22} color={colors.text} />
            </Pressable>
            <AppText variant="h3">Bodyn Coach</AppText>
            <Pressable onPress={close} hitSlop={12} style={styles.roundBtn} accessibilityLabel="Close coach">
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: space.lg }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {msgs.length === 0 ? (
              <View style={{ flex: 1 }}>
                <View style={{ alignItems: 'center', marginTop: space.xl }}>
                  <Orb />
                  <AppText variant="h2" style={{ marginTop: space.lg }}>
                    Hi there,
                  </AppText>
                  <AppText muted style={{ fontStyle: 'italic', marginTop: 4, textAlign: 'center' }}>
                    {date === health.lastDay ? "What's on your mind today?" : `What's on your mind about ${dateLabel(date, health.lastDay)}?`}
                  </AppText>
                </View>
                <View style={[styles.chips, { marginTop: space.xl }]}>{prompts.map(chip)}</View>
              </View>
            ) : (
              <View style={{ gap: space.md }}>
                {msgs.map((m, i) => (
                  <View key={m.id} style={{ gap: space.sm }}>
                    <View style={[styles.bubble, m.from === 'me' ? styles.mine : styles.theirs]}>
                      <AppText style={m.from === 'me' ? { color: colors.onLime } : undefined}>{m.text}</AppText>
                      {m.bullets?.map((b) => (
                        <View key={b} style={{ flexDirection: 'row', gap: space.sm, marginTop: 6 }}>
                          <AppText muted>•</AppText>
                          <AppText variant="small" style={{ flex: 1 }}>
                            {b}
                          </AppText>
                        </View>
                      ))}
                    </View>
                    {i === msgs.length - 1 && !typing && m.from === 'coach' && m.chips?.length ? <View style={styles.chips}>{m.chips.map(chip)}</View> : null}
                  </View>
                ))}
                {typing ? (
                  <View style={[styles.bubble, styles.theirs]}>
                    <AppText muted>Thinking…</AppText>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.inputRow}>
              <TextInput
                value={input}
                onChangeText={setInput}
                onSubmitEditing={() => send(input)}
                placeholder="Ask your coach…"
                placeholderTextColor={colors.textDim}
                returnKeyType="send"
                style={styles.input}
                accessibilityLabel="Ask your coach"
              />
              <Pressable onPress={() => send(input)} style={[styles.send, (!input.trim() || typing) && { opacity: 0.4 }]} accessibilityLabel="Send" disabled={!input.trim() || typing}>
                <Ionicons name="arrow-up" size={20} color={colors.onLime} />
              </Pressable>
            </View>
            <AppText variant="tiny" muted style={{ textAlign: 'center' }}>
              General guidance from your data, not medical advice.
            </AppText>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ChatDrawer
        visible={menu}
        threads={threads}
        activeId={activeId}
        onClose={() => setMenu(false)}
        onNew={() => {
          startNew();
          setMenu(false);
        }}
        onOpen={(id) => {
          open(id);
          setMenu(false);
        }}
        onDelete={remove}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  roundBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '88%', paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.md },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.lime },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, gap: 6, backgroundColor: colors.bg },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { flex: 1, height: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 14 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
}));
