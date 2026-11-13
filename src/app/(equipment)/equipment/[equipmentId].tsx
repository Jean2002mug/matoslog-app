import { useLocalSearchParams } from 'expo-router';

import { ExerciseList } from '@/features/catalog/exercise-list';

export default function ExercisesScreen() {
  const { equipmentId } = useLocalSearchParams<{ equipmentId: string }>();
  return <ExerciseList equipmentId={equipmentId} />;
}
