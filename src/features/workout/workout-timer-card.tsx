import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spacing } from '@/constants/theme';
import { plural } from '@/domain/history';
import { formatClock, workoutActiveMs } from '@/domain/timer';
import { useServices } from '@/features/services-provider';
import { useConfirm } from '@/features/use-confirm';

import { useActiveWorkout } from './active-workout-provider';
import { useNow } from './use-now';

interface WorkoutTimerCardProps {
  /** Compact: clock and Pause/Resume only (used on the set logger). */
  compact?: boolean;
  /** Shown under the buttons when an action fails. */
  onError?(message: string): void;
}

/**
 * The workout timer: running clock (frozen while paused), Pause/Resume, Finish, and Cancel.
 * Cancelling the workout timer cancels the WORKOUT — its sets are deleted — so it asks first,
 * with a "Don't ask again" option. Renders nothing when no workout is active.
 */
export function WorkoutTimerCard({ compact = false, onError }: WorkoutTimerCardProps) {
  const { workout } = useServices();
  const { state, loadedAt, run } = useActiveWorkout();
  const active = state.status === 'ready' ? state.active : null;
  const paused = active?.workout.pausedAt != null;
  const now = useNow(active !== null && !paused);

  const finishConfirm = useConfirm({
    title: 'Finish workout?',
    message: 'It will be saved to History and can’t be changed afterwards.',
    confirmLabel: 'Finish workout',
  });
  const cancelConfirm = useConfirm(
    {
      title: 'Cancel this workout?',
      message: 'The workout and all its sets will be deleted. This can’t be undone.',
      confirmLabel: 'Cancel workout',
      destructive: true,
    },
    'confirmCancelWorkout',
  );

  if (!active) return null;

  const elapsed = formatClock(workoutActiveMs(active.workout.startedAt, active.workout, Math.max(now, loadedAt)));
  const report = (result: { ok: boolean; error?: string }) => {
    if (!result.ok && result.error) onError?.(result.error);
  };

  const pauseButton = paused ? (
    <AppButton
      label="Resume"
      compact={compact}
      accessibilityLabel="Resume workout"
      onPress={async () => report(await run(() => workout.resumeWorkout()))}
    />
  ) : (
    <AppButton
      label="Pause"
      variant="secondary"
      compact={compact}
      accessibilityLabel="Pause workout"
      onPress={async () => report(await run(() => workout.pauseWorkout()))}
    />
  );

  if (compact) {
    return (
      <ThemedView type="backgroundElement" style={styles.compact}>
        <ThemedText
          type="smallBold"
          style={[styles.flex, styles.digits]}
          accessibilityLabel={`Workout time ${elapsed}${paused ? ', paused' : ''}`}>
          {paused ? 'Paused' : 'Workout'} · {elapsed}
        </ThemedText>
        {pauseButton}
      </ThemedView>
    );
  }

  return (
    <ThemedView type="backgroundSelected" style={styles.card}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{paused ? 'Workout paused' : 'Workout in progress'}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {plural(active.sets.length, 'set')}
        </ThemedText>
      </View>
      <ThemedText
        type="subtitle"
        style={styles.digits}
        accessibilityLabel={`Workout time ${elapsed}${paused ? ', paused' : ''}`}>
        {elapsed}
      </ThemedText>
      <View style={styles.actions}>
        {pauseButton}
        <AppButton
          label="Finish"
          onPress={() => finishConfirm.request(async () => report(await run(() => workout.finishWorkout())))}
        />
        <AppButton
          label="Cancel"
          variant="secondary"
          accessibilityLabel="Cancel workout"
          onPress={() =>
            cancelConfirm.request(async () => report(await run(() => workout.discardWorkout())))
          }
        />
      </View>
      <ConfirmDialog {...finishConfirm.dialogProps} />
      <ConfirmDialog {...cancelConfirm.dialogProps} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  // Equal-width digits, so the clock doesn't wobble as the numbers change.
  digits: {
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
