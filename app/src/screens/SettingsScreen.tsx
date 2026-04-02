import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import {
  List,
  Switch,
  useTheme,
  Text,
  Divider,
  Menu,
  Button,
  Snackbar,
  Portal,
  Dialog,
  SegmentedButtons,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { getSettings, updateSettings } from '../database/db';
import { exportData, importData } from '../services/exportImport';
import { requestNotificationPermissions } from '../services/notifications';
import { CURRENCIES, type ThemeMode } from '../types';
import type { Settings } from '../types';
import { DropdownField } from '../components/DropdownField';

const BILL_LOOKAHEAD_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const REMIND_BEFORE_DAY_OPTIONS = Array.from({ length: 31 }, (_, index) => index);
const OVERDUE_INTERVAL_OPTIONS = Array.from({ length: 30 }, (_, index) => index + 1);

interface SettingsScreenProps {
  onThemeChange?: (mode: ThemeMode) => void;
  onLanguageChange?: (lang: string) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onThemeChange, onLanguageChange }) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [importDialogVisible, setImportDialogVisible] = useState(false);
  const [, setImporting] = useState(false);

  const loadSettings = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const updateSetting = async (key: string, value: unknown) => {
    await updateSettings({ [key]: value } as Partial<Settings>);
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const handleCurrencyChange = async (cur: string) => {
    await updateSetting('default_currency', cur);
  };

  const handleLanguageChange = async (lang: string) => {
    await updateSetting('language', lang);
    i18n.changeLanguage(lang);
    onLanguageChange?.(lang);
  };

  const handleThemeChange = async (mode: string) => {
    await updateSetting('theme_mode', mode);
    onThemeChange?.(mode as ThemeMode);
  };

  const handleExport = async () => {
    try {
      const exportPath = await exportData();
      if (!exportPath) {
        return;
      }
      setSnackbarMessage(t('settings.exportSuccess'));
      setSnackbarVisible(true);
    } catch {
      setSnackbarMessage(t('settings.exportError'));
      setSnackbarVisible(true);
    }
  };

  const handleImportConfirm = async () => {
    setImportDialogVisible(false);
    setImporting(true);
    try {
      const success = await importData();
      if (success) {
        await loadSettings();
        setSnackbarMessage(t('settings.importSuccess'));
      } else {
        setSnackbarMessage(t('settings.importError'));
      }
    } catch {
      setSnackbarMessage(t('settings.importError'));
    } finally {
      setImporting(false);
      setSnackbarVisible(true);
    }
  };

  const handleRemindersToggle = async (enabled: boolean) => {
    if (enabled) {
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) {
        setSnackbarMessage(t('settings.notificationPermission'));
        setSnackbarVisible(true);
        return;
      }
    }
    await updateSetting('reminders_enabled', enabled ? 1 : 0);
  };

  if (!settings) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Language */}
        <List.Section>
          <List.Subheader>{t('settings.language')}</List.Subheader>
          <SegmentedButtons
            value={settings.language}
            onValueChange={handleLanguageChange}
            buttons={[
              { value: 'en', label: t('languages.en') },
              { value: 'de', label: t('languages.de') },
            ]}
            style={styles.segmented}
          />
        </List.Section>

        <Divider />

        {/* Theme */}
        <List.Section>
          <List.Subheader>{t('settings.theme')}</List.Subheader>
          <SegmentedButtons
            value={settings.theme_mode}
            onValueChange={handleThemeChange}
            buttons={[
              { value: 'system', label: t('settings.themeSystem') },
              { value: 'light', label: t('settings.themeLight') },
              { value: 'dark', label: t('settings.themeDark') },
            ]}
            style={styles.segmented}
          />
        </List.Section>

        <Divider />

        {/* Default Currency */}
        <List.Section>
          <List.Subheader>{t('settings.defaultCurrency')}</List.Subheader>
          <View style={styles.dropdownField}>
            <DropdownField
              label={t('settings.defaultCurrency')}
              value={settings.default_currency}
              maxHeight={300}
            >
              {(close) =>
                CURRENCIES.map((cur) => (
                  <Menu.Item
                    key={cur}
                    title={cur}
                    onPress={() => {
                      handleCurrencyChange(cur);
                      close();
                    }}
                  />
                ))
              }
            </DropdownField>
          </View>
        </List.Section>

        <Divider />

        {/* Bills Lookahead */}
        <List.Section>
          <List.Subheader>{t('settings.billsLookahead')}</List.Subheader>
          <View style={styles.dropdownField}>
            <DropdownField
              label={t('settings.billsLookaheadMonths')}
              value={settings.bills_lookahead_months.toString()}
              maxHeight={300}
            >
              {(close) =>
                BILL_LOOKAHEAD_OPTIONS.map((months) => (
                  <Menu.Item
                    key={months}
                    title={months.toString()}
                    onPress={() => {
                      updateSetting('bills_lookahead_months', months);
                      close();
                    }}
                  />
                ))
              }
            </DropdownField>
          </View>
        </List.Section>

        <Divider />

        {/* Reminders */}
        <List.Section>
          <List.Subheader>{t('settings.reminders')}</List.Subheader>
          <List.Item
            title={t('settings.remindersEnabled')}
            right={() => (
              <Switch
                value={settings.reminders_enabled === 1}
                onValueChange={handleRemindersToggle}
              />
            )}
          />
          {settings.reminders_enabled === 1 && (
            <>
              <View style={styles.dropdownField}>
                <DropdownField
                  label={t('settings.remindBeforeDays')}
                  value={settings.remind_before_days.toString()}
                  maxHeight={300}
                >
                  {(close) =>
                    REMIND_BEFORE_DAY_OPTIONS.map((days) => (
                      <Menu.Item
                        key={days}
                        title={days.toString()}
                        onPress={() => {
                          updateSetting('remind_before_days', days);
                          close();
                        }}
                      />
                    ))
                  }
                </DropdownField>
              </View>
              <List.Item
                title={t('settings.remindOnDueDate')}
                right={() => (
                  <Switch
                    value={settings.remind_on_due_date === 1}
                    onValueChange={(v) => updateSetting('remind_on_due_date', v ? 1 : 0)}
                  />
                )}
              />
              <List.Item
                title={t('settings.remindWhenOverdue')}
                right={() => (
                  <Switch
                    value={settings.remind_when_overdue === 1}
                    onValueChange={(v) => updateSetting('remind_when_overdue', v ? 1 : 0)}
                  />
                )}
              />
              {settings.remind_when_overdue === 1 && (
                <View style={styles.dropdownField}>
                  <DropdownField
                    label={t('settings.overdueReminderInterval')}
                    value={settings.overdue_reminder_interval_days.toString()}
                    maxHeight={300}
                  >
                    {(close) =>
                      OVERDUE_INTERVAL_OPTIONS.map((days) => (
                        <Menu.Item
                          key={days}
                          title={days.toString()}
                          onPress={() => {
                            updateSetting('overdue_reminder_interval_days', days);
                            close();
                          }}
                        />
                      ))
                    }
                  </DropdownField>
                </View>
              )}
            </>
          )}
        </List.Section>

        <Divider />

        {/* Data Management */}
        <List.Section>
          <List.Subheader>{t('settings.dataManagement')}</List.Subheader>
          <List.Item
            title={t('settings.exportData')}
            description={t('settings.exportDesc')}
            left={(props) => <List.Icon {...props} icon="export" />}
            onPress={handleExport}
          />
          <List.Item
            title={t('settings.importData')}
            description={t('settings.importDesc')}
            left={(props) => <List.Icon {...props} icon="import" />}
            onPress={() => setImportDialogVisible(true)}
          />
        </List.Section>

        <Divider />

        {/* About */}
        <List.Section>
          <List.Item
            title={t('settings.appVersion')}
            description="1.0.0"
            left={(props) => <List.Icon {...props} icon="information-outline" />}
          />
        </List.Section>
      </ScrollView>

      {/* Import Confirmation Dialog */}
      <Portal>
        <Dialog visible={importDialogVisible} onDismiss={() => setImportDialogVisible(false)}>
          <Dialog.Title>{t('settings.importData')}</Dialog.Title>
          <Dialog.Content>
            <Text>{t('settings.importConfirm')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setImportDialogVisible(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleImportConfirm} textColor={theme.colors.error}>
              {t('common.confirm')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  segmented: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  dropdownField: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
});
