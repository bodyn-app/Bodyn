import { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

import { useTheme } from '@/theme';

const THUMB = 26;

/**
 * A drag-to-select horizontal slider (tap anywhere on the track, or drag the thumb) — used wherever a
 * preference is a value within a range and stepping it one click at a time (a `Stepper`) would be tedious,
 * e.g. a sleep-duration goal from 5h to 11h.
 */
export function RangeSlider({ value, min, max, step = 1, onChange }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const { colors } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<View>(null);
  const originX = useRef(0);

  // PanResponder is built once (via useRef below) and its handlers close over whatever this ref points to at
  // call time, not at creation time — this is what keeps drags working after the very first layout/value change,
  // instead of the handlers being frozen with the trackWidth (0) and onChange from the initial render.
  const latest = useRef({ value, min, max, step, onChange, trackWidth });
  latest.current = { value, min, max, step, onChange, trackWidth };

  const valueFromPageX = (pageX: number) => {
    const s = latest.current;
    if (!s.trackWidth) return s.value;
    const pct = Math.min(1, Math.max(0, (pageX - originX.current) / s.trackWidth));
    const raw = s.min + pct * (s.max - s.min);
    return Math.min(s.max, Math.max(s.min, Math.round(raw / s.step) * s.step));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // keep the drag once it starts, even if an ancestor ScrollView tries to reclaim it
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => latest.current.onChange(valueFromPageX(e.nativeEvent.pageX)),
      onPanResponderMove: (e) => latest.current.onChange(valueFromPageX(e.nativeEvent.pageX)),
    })
  ).current;

  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <View
      ref={trackRef}
      onLayout={() => {
        // measure() gives the track's on-screen (page) origin, which stays correct however the parent scrolls,
        // unlike a touch's `locationX` (relative to whatever sub-view the finger happens to be over).
        trackRef.current?.measure((_x, _y, width, _height, pageX) => {
          setTrackWidth(width);
          originX.current = pageX;
        });
      }}
      {...pan.panHandlers}
      style={{ height: THUMB + 8, justifyContent: 'center' }}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.barIdle, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${pct}%`, backgroundColor: colors.core }} />
      </View>
      <View
        style={{
          position: 'absolute',
          left: `${pct}%`,
          marginLeft: -THUMB / 2,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: '#fff',
          borderWidth: 3,
          borderColor: colors.core,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      />
    </View>
  );
}
