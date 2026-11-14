import { useLocalSearchParams } from 'expo-router';

import { SetLogger } from '@/features/workout/set-logger';

export default function LogSetsScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  return <SetLogger exerciseId={exerciseId} />;
}
