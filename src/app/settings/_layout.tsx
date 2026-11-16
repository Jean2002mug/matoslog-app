import { Stack } from 'expo-router';

/** The Settings tab: a single screen, inside a Stack so it gets a header like the other tabs. */
export default function SettingsStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
    </Stack>
  );
}
