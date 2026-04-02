import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Linking, Platform, type LayoutChangeEvent } from 'react-native';
import {
  List,
  Switch,
  useTheme,
  Text,
  Divider,
  Menu,
  TextInput,
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

interface SettingsScreenProps {
  onThemeChange?: (mode: ThemeMode) => void;
  onLanguageChange?: (lang: string) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onThemeChange, onLanguageChange }) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);
  const [currencyMenuWidth, setCurrencyMenuWidth] = useState(0);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [importDialogVisible, setImportDialogVisible] = useState(false);
  const [importing, setImporting] = useState(false);

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
    setCurrencyMenuVisible(false);
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
      await exportData();
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
          <View onLayout={(e: LayoutChangeEvent) => setCurrencyMenuWidth(e.nativeEvent.layout.width)}>
            <Menu
              visible={currencyMenuVisible}
              onDismiss={() => setCurrencyMenuVisible(false)}
              contentStyle={currencyMenuWidth ? { width: currencyMenuWidth } : undefined}
              anchor={
                <List.Item
                  title={settings.default_currency}
                  right={(props) => <List.Icon {...props} icon="chevron-down" />}
                  onPress={() => setCurrencyMenuVisible(true)}
                />
              }
            >
              <ScrollView style={{ maxHeight: 300 }}>
                {CURRENCIES.map((cur) => (
                  <Menu.Item
                    key={cur}
                    title={cur}
                    onPress={() => handleCurrencyChange(cur)}
                  />
                ))}
              </ScrollView>
            </Menu>
          </View>
        </List.Section>

        <Divider />

        {/* Bills Lookahead */}
        <List.Section>
          <List.Subheader>{t('settings.billsLookahead')}</List.Subheader>
          <List.Item
            title={t('settings.billsLookaheadMonths')}
            right={() => (
              <TextInput
                value={settings.bills_lookahead_months.toString()}
                onChangeText={(v) => {
                  const num = parseInt(v, 10);
                  if (!isNaN(num) && num >= 1 && num <= 12) updateSetting('bills_lookahead_months', num);
                }}
                keyboardType="number-pad"
                mode="outlined"
                style={styles.numberInput}
                dense
              />
            )}
          />
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
              <List.Item
                title={t('settings.remindBeforeDays')}
                right={() => (
                  <TextInput
                    value={settings.remind_before_days.toString()}
                    onChangeText={(v) => {
                      const num = parseInt(v, 10);
                      if (!isNaN(num) && num >= 0) updateSetting('remind_before_days', num);
                    }}
                    keyboardType="number-pad"
                    mode="outlined"
                    style={styles.numberInput}
                    dense
                  />
                )}
              />
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
                <List.Item
                  title={t('settings.overdueReminderInterval')}
                  right={() => (
                    <TextInput
                      value={settings.overdue_reminder_interval_days.toString()}
                      onChangeText={(v) => {
                        const num = parseInt(v, 10);
                        if (!isNaN(num) && num >= 1) updateSetting('overdue_reminder_interval_days', num);
                      }}
                      keyboardType="number-pad"
                      mode="outlined"
                      style={styles.numberInput}
                      dense
                    />
                  )}
                />
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
  numberInput: {
    width: 60,
    height: 36,
    textAlign: 'center',
  },
});
