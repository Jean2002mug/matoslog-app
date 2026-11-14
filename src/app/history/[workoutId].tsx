import { useLocalSearchParams } from 'expo-router';

import { WorkoutDetail } from '@/features/history/workout-detail';

export default function WorkoutScreen() {
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();
  return <WorkoutDetail workoutId={workoutId} />;
}
