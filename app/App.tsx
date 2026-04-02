import React, { useState, useEffect, useCallback } from 'react';
import { useColorScheme, StatusBar } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';

import { en, de, registerTranslation } from 'react-native-paper-dates';
import { lightTheme, darkTheme } from './src/theme';
import { AppNavigator } from './src/navigation/AppNavigator';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { getSettings } from './src/database/db';
import type { ThemeMode } from './src/types';
import './src/localization/i18n';

registerTranslation('en', en);
registerTranslation('de', de);

export default function App() {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [, setLanguageKey] = useState(0); // Force re-render on language change

  useEffect(() => {
    const init = async () => {
      try {
        const settings = await getSettings();
        setThemeMode(settings.theme_mode);
        setOnboardingCompleted(settings.onboarding_completed === 1);

        // Set up i18n language from settings
        const i18n = (await import('./src/localization/i18n')).default;
        if (settings.language) {
          i18n.changeLanguage(settings.language);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        setOnboardingCompleted(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    // Handle notification taps
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const billId = response.notification.request.content.data?.billId;
      if (billId) {
        // Navigation will be handled by deep linking or manual navigation
        console.log('Navigate to bill:', billId);
      }
    });
    return () => subscription.remove();
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
  const theme = isDark ? darkTheme : lightTheme;

  const handleThemeChange = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
  }, []);

  const handleLanguageChange = useCallback(() => {
    setLanguageKey((k) => k + 1);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingCompleted(true);
  }, []);

  if (onboardingCompleted === null) {
    return null; // Loading
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <NavigationContainer
            theme={{
              dark: isDark,
              colors: {
                primary: theme.colors.primary,
                background: theme.colors.background,
                card: theme.colors.elevation.level2,
                text: theme.colors.onSurface,
                border: theme.colors.outlineVariant,
                notification: theme.colors.error,
              },
              fonts: {
                regular: { fontFamily: 'System', fontWeight: '400' },
                medium: { fontFamily: 'System', fontWeight: '500' },
                bold: { fontFamily: 'System', fontWeight: '700' },
                heavy: { fontFamily: 'System', fontWeight: '900' },
              },
            }}
          >
            <StatusBar
              barStyle={isDark ? 'light-content' : 'dark-content'}
              backgroundColor={theme.colors.elevation.level2}
            />
            {onboardingCompleted ? (
              <AppNavigator
                onThemeChange={handleThemeChange}
                onLanguageChange={handleLanguageChange}
              />
            ) : (
              <OnboardingScreen
                onComplete={handleOnboardingComplete}
                onLanguageChange={handleLanguageChange}
              />
            )}
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
