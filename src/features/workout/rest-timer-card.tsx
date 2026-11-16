import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AppButton } from '@/components/ui/app-button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Spacing } from '@/constants/theme';
import type { Result } from '@/domain/result';
import { formatClock, isRestPaused, REST_STEP_MS, restRemaining } from '@/domain/timer';
import { useServices } from '@/features/services-provider';
import { useConfirm } from '@/features/use-confirm';

import { useActiveWorkout } from './active-workout-provider';
import { useNow } from './use-now';

/**
 * The rest countdown after a set: Pause/Resume, Reset, −15 s / +15 s, and Cancel.
 * Cancelling only stops the rest (the workout carries on), after asking — with "Don't ask again".
 * At zero it shows "Next set!" with Dismiss. Renders nothing when no rest is running.
 */
export function RestTimerCard({ onError }: { onError?(message: string): void }) {
  const { workout } = useServices();
  const { state, loadedAt, run } = useActiveWorkout();
  const active = state.status === 'ready' ? state.active : null;
  const rest = active?.workout.rest ?? null;
  const workoutPaused = active?.workout.pausedAt != null;
  const now = useNow(rest !== null && !isRestPaused(rest));

  const cancelConfirm = useConfirm(
    {
      title: 'Cancel this rest?',
      message: 'The rest timer will stop. Your workout carries on.',
      confirmLabel: 'Cancel rest',
    },
    'confirmCancelRest',
  );

  if (!rest) return null;

  const remaining = restRemaining(rest, Math.max(now, loadedAt));
  const over = remaining === 0;
  const paused = isRestPaused(rest);
  const act = async (action: () => Promise<Result<unknown>>) => {
    const result = await run(action);
    if (!result.ok) onError?.(result.error);
  };

  const label = over ? 'Rest over' : paused ? 'Rest paused' : 'Rest';

  return (
    <ThemedView type="backgroundSelected" style={styles.card}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText
        type="subtitle"
        style={styles.clock}
        accessibilityLabel={over ? 'Rest over' : `Rest time left ${formatClock(remaining)}`}>
        {over ? 'Next set!' : formatClock(remaining)}
      </ThemedText>

      {over ? (
        <AppButton label="Dismiss" compact onPress={() => act(() => workout.cancelRest())} />
      ) : workoutPaused ? (
        <ThemedText type="small" themeColor="textSecondary">
          Paused with the workout. Resume the workout to continue.
        </ThemedText>
      ) : (
        <>
          <View style={styles.actions}>
            {paused ? (
              <AppButton
                label="Resume"
                compact
                accessibilityLabel="Resume rest"
                onPress={() => act(() => workout.resumeRest())}
              />
            ) : (
              <AppButton
                label="Pause"
                variant="secondary"
                compact
                accessibilityLabel="Pause rest"
                onPress={() => act(() => workout.pauseRest())}
              />
            )}
            <AppButton
              label="Reset"
              variant="secondary"
              compact
              accessibilityLabel="Reset rest"
              onPress={() => act(() => workout.resetRest())}
            />
            <AppButton
              label="Cancel"
              variant="secondary"
              compact
              accessibilityLabel="Cancel rest"
              onPress={() => cancelConfirm.request(() => act(() => workout.cancelRest()))}
            />
          </View>
          <View style={styles.actions}>
            <AppButton
              label="−15 s"
              variant="secondary"
              compact
              accessibilityLabel="Remove 15 seconds"
              onPress={() => act(() => workout.adjustRest(-REST_STEP_MS))}
            />
            <AppButton
              label="+15 s"
              variant="secondary"
              compact
              accessibilityLabel="Add 15 seconds"
              onPress={() => act(() => workout.adjustRest(REST_STEP_MS))}
            />
          </View>
        </>
      )}
      <ConfirmDialog {...cancelConfirm.dialogProps} />
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
