import { Stack } from 'expo-router';

/**
 * The Equipment tab is a stack: Equipment -> Exercises -> Log sets.
 * Native tabs have no header of their own, so the stack provides headers and the back button.
 * Titles here are placeholders; each screen replaces them with the real name once loaded.
 */
export default function EquipmentStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Equipment' }} />
      <Stack.Screen name="equipment/[equipmentId]" options={{ title: 'Exercises' }} />
      <Stack.Screen name="exercise/[exerciseId]" options={{ title: 'Log sets' }} />
    </Stack>
  );
}
