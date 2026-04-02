import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Dimensions, Pressable, type LayoutChangeEvent } from 'react-native';
import {
  Button,
  Text,
  useTheme,
  Surface,
  SegmentedButtons,
  Menu,
  Icon,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { updateSettings } from '../database/db';
import { CURRENCIES } from '../types';

const TOTAL_STEPS = 8; // 0=welcome, 1=setup, 2-6=tour, 7=ready

interface TourStep {
  icon: string;
  titleKey: string;
  descKey: string;
}

const TOUR_STEPS: TourStep[] = [
  { icon: 'lightning-bolt', titleKey: 'onboarding.tourQuickBillTitle', descKey: 'onboarding.tourQuickBillDesc' },
  { icon: 'file-document-outline', titleKey: 'onboarding.tourContractsTitle', descKey: 'onboarding.tourContractsDesc' },
  { icon: 'account-search', titleKey: 'onboarding.tourProvidersTitle', descKey: 'onboarding.tourProvidersDesc' },
  { icon: 'camera-document', titleKey: 'onboarding.tourProofTitle', descKey: 'onboarding.tourProofDesc' },
  { icon: 'cloud-upload', titleKey: 'onboarding.tourBackupTitle', descKey: 'onboarding.tourBackupDesc' },
];

interface OnboardingScreenProps {
  onComplete: () => void;
  onLanguageChange: (lang: string) => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete, onLanguageChange }) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState(i18n.language === 'de' ? 'de' : 'en');
  const [currency, setCurrency] = useState('CHF');
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);
  const [currencyMenuWidth, setCurrencyMenuWidth] = useState(0);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    onLanguageChange(lang);
  };

  const handleFinish = async () => {
    await updateSettings({
      language,
      default_currency: currency,
      onboarding_completed: 1,
    });
    onComplete();
  };

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const renderStep0 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Icon source="receipt" size={80} color={theme.colors.primary} />
      </View>
      <Text variant="headlineLarge" style={[styles.title, { color: theme.colors.onBackground }]}>
        {t('onboarding.welcome')}
      </Text>
      <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
        {t('onboarding.welcomeDesc')}
      </Text>
      <Button mode="contained" onPress={goNext} style={styles.button}>
        {t('onboarding.getStarted')}
      </Button>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onBackground }]}>
        {t('onboarding.setupTitle')}
      </Text>
      <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
        {t('onboarding.setupDesc')}
      </Text>

      <Surface style={[styles.settingsCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
        <Text variant="labelLarge" style={styles.fieldLabel}>{t('onboarding.selectLanguage')}</Text>
        <SegmentedButtons
          value={language}
          onValueChange={handleLanguageChange}
          buttons={[
            { value: 'en', label: 'English' },
            { value: 'de', label: 'Deutsch' },
          ]}
          style={styles.segmented}
        />

        <Text variant="labelLarge" style={[styles.fieldLabel, { marginTop: 20 }]}>
          {t('onboarding.selectCurrency')}
        </Text>
        <View onLayout={(e: LayoutChangeEvent) => setCurrencyMenuWidth(e.nativeEvent.layout.width)}>
          <Menu
            visible={currencyMenuVisible}
            onDismiss={() => setCurrencyMenuVisible(false)}
            contentStyle={currencyMenuWidth ? { width: currencyMenuWidth } : undefined}
            anchor={
              <Pressable onPress={() => setCurrencyMenuVisible(true)}>
                <View pointerEvents="none">
                  <Button
                    mode="outlined"
                    icon="chevron-down"
                    contentStyle={styles.currencyButtonContent}
                  >
                    {currency}
                  </Button>
                </View>
              </Pressable>
            }
          >
            <ScrollView style={{ maxHeight: 300 }}>
              {CURRENCIES.map((cur) => (
                <Menu.Item
                  key={cur}
                  title={cur}
                  onPress={() => {
                    setCurrency(cur);
                    setCurrencyMenuVisible(false);
                  }}
                />
              ))}
            </ScrollView>
          </Menu>
        </View>
      </Surface>

      <View style={styles.buttonRow}>
        <Button mode="text" onPress={goBack}>
          {t('common.back')}
        </Button>
        <Button mode="contained" onPress={goNext}>
          {t('onboarding.next')}
        </Button>
      </View>
    </View>
  );

  const renderTourStep = (tourIndex: number) => {
    const tour = TOUR_STEPS[tourIndex];
    return (
      <View style={styles.stepContainer}>
        <View style={[styles.tourIconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon source={tour.icon} size={48} color={theme.colors.primary} />
        </View>
        <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onBackground }]}>
          {t(tour.titleKey)}
        </Text>
        <Text variant="bodyLarge" style={[styles.tourDesc, { color: theme.colors.onSurfaceVariant }]}>
          {t(tour.descKey)}
        </Text>
        <View style={styles.buttonRow}>
          <Button mode="text" onPress={goBack}>
            {t('common.back')}
          </Button>
          <Button mode="contained" onPress={goNext}>
            {t('onboarding.next')}
          </Button>
        </View>
        <Button mode="text" onPress={handleFinish} compact>
          {t('onboarding.skipForNow')}
        </Button>
      </View>
    );
  };

  const renderReady = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Icon source="check-circle" size={80} color={theme.colors.primary} />
      </View>
      <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onBackground }]}>
        {t('onboarding.tourReadyTitle')}
      </Text>
      <Text variant="bodyLarge" style={[styles.tourDesc, { color: theme.colors.onSurfaceVariant }]}>
        {t('onboarding.tourReadyDesc')}
      </Text>

      <Button mode="contained" onPress={handleFinish} style={styles.button}>
        {t('onboarding.letsGo')}
      </Button>
      <Button mode="text" onPress={goBack}>
        {t('common.back')}
      </Button>
    </View>
  );

  const renderCurrentStep = () => {
    if (step === 0) return renderStep0();
    if (step === 1) return renderStep1();
    if (step >= 2 && step <= 6) return renderTourStep(step - 2);
    return renderReady();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Step indicators */}
      <View style={styles.indicators}>
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.indicator,
              {
                backgroundColor: i <= step ? theme.colors.primary : theme.colors.outlineVariant,
              },
            ]}
          />
        ))}
      </View>

      {renderCurrentStep()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 60,
    paddingBottom: 20,
  },
  indicator: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  iconContainer: {
    marginBottom: 16,
  },
  tourIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  tourDesc: {
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  settingsCard: {
    width: '100%',
    padding: 20,
    borderRadius: 12,
  },
  fieldLabel: {
    marginBottom: 8,
  },
  segmented: {
    marginBottom: 4,
  },
  currencyButtonContent: {
    flexDirection: 'row-reverse',
  },
  button: {
    minWidth: 200,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
});
