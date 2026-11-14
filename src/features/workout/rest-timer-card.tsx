import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { Spacing } from '@/constants/theme';
import { formatClock, REST_STEP_MS, restRemaining } from '@/domain/timer';

import { useNow } from './use-now';
import { useRestTimer } from './rest-timer-provider';

/**
 * The rest countdown shown after logging a set: big clock, −15 s / +15 s, and Skip.
 * When it reaches zero it says so and offers Dismiss. Renders nothing when no rest is running.
 */
export function RestTimerCard() {
  const timer = useRestTimer();
  const now = useNow(timer.endsAt !== null);

  if (timer.endsAt === null) return null;

  // max(): never count from a moment before the timer was last started or adjusted.
  const remaining = restRemaining(timer.endsAt, Math.max(now, timer.updatedAt ?? now));
  const over = remaining === 0;

  return (
    <ThemedView type="backgroundSelected" style={styles.card}>
      <ThemedText type="smallBold">{over ? 'Rest over' : 'Rest'}</ThemedText>
      <ThemedText
        type="subtitle"
        style={styles.clock}
        accessibilityLabel={over ? 'Rest over' : `Rest time left ${formatClock(remaining)}`}>
        {over ? 'Next set!' : formatClock(remaining)}
      </ThemedText>
      <View style={styles.actions}>
        {!over && (
          <>
            <AppButton
              label="−15 s"
              variant="secondary"
              compact
              accessibilityLabel="Remove 15 seconds"
              onPress={() => timer.adjust(-REST_STEP_MS)}
            />
            <AppButton
              label="+15 s"
              variant="secondary"
              compact
              accessibilityLabel="Add 15 seconds"
              onPress={() => timer.adjust(REST_STEP_MS)}
            />
          </>
        )}
        <AppButton label={over ? 'Dismiss' : 'Skip'} compact onPress={timer.skip} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  clock: {
    // Equal-width digits, so the clock doesn't wobble as the numbers change.
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
});
