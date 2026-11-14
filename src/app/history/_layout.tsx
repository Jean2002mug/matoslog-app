import { Stack } from 'expo-router';

/**
 * The History tab is a stack: History -> one workout.
 * It's a plain folder (not a group) so its URL is /history and doesn't clash with
 * the Equipment tab's "/".
 */
export default function HistoryStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'History' }} />
      <Stack.Screen name="[workoutId]" options={{ title: 'Workout' }} />
    </Stack>
  );
}
