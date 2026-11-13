import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { DATABASE_NAME, initializeDatabase } from '@/data/database';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* Opens the database and runs migrations + seed before any screen renders. */}
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initializeDatabase}>
        <AnimatedSplashOverlay />
        <AppTabs />
      </SQLiteProvider>
    </ThemeProvider>
  );
}
