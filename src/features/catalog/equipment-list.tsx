import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ListRow } from '@/components/ui/list-row';
import { ScreenScrollView } from '@/components/ui/screen-scroll-view';
import { describeWeightConvention, type Equipment } from '@/domain/catalog';
import { useServices } from '@/features/services-provider';
import { ActiveWorkoutBanner } from '@/features/workout/active-workout-banner';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; equipment: Equipment[] };

/** Lists every piece of equipment in the catalog. Tap one to see its exercises. */
export function EquipmentList() {
  const { catalog } = useServices();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false; // ignore the result if the screen closed while loading
    catalog.listEquipment().then((result) => {
      if (cancelled) return;
      setState(
        result.ok
          ? { status: 'ready', equipment: result.value }
          : { status: 'error', message: result.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  // The scroll view is the screen's first child — see ScreenScrollView for why.
  return (
    <ScreenScrollView>
      <ActiveWorkoutBanner />

      {state.status === 'loading' && <ActivityIndicator />}

      {state.status === 'error' && <ThemedText themeColor="textSecondary">{state.message}</ThemedText>}

      {state.status === 'ready' && state.equipment.length === 0 && (
        <ThemedText themeColor="textSecondary">No equipment yet.</ThemedText>
      )}

      {state.status === 'ready' &&
        state.equipment.map((item) => (
          <Link
            key={item.id}
            href={{ pathname: '/equipment/[equipmentId]', params: { equipmentId: item.id } }}
            asChild>
            <ListRow title={item.name} subtitle={describeWeightConvention(item)} />
          </Link>
        ))}
    </ScreenScrollView>
  );
}
