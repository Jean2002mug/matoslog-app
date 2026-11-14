import type { TextProps } from 'react-native';

import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { elapsedSince, formatClock } from '@/domain/timer';

import { useNow } from './use-now';

type WorkoutClockProps = Omit<ThemedTextProps, 'children'> & {
  /** The workout's start time (UTC ISO-8601). */
  startedAt: string;
  /** Text before the time, e.g. "Workout · ". */
  prefix?: string;
  style?: TextProps['style'];
};

/**
 * How long the active workout has been running, ticking every second ("12:34").
 * Computed from the stored start time, so it's still right after the app restarts.
 */
export function WorkoutClock({ startedAt, prefix = '', style, ...props }: WorkoutClockProps) {
  const now = useNow(true);
  const elapsed = formatClock(elapsedSince(startedAt, now));
  return (
    <ThemedText
      {...props}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      accessibilityLabel={`Workout time ${elapsed}`}>
      {prefix}
      {elapsed}
    </ThemedText>
  );
}
