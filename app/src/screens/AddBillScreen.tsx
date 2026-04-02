import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, ScrollView, Pressable } from 'react-native';
import {
  TextInput,
  Button,
  useTheme,
  Appbar,
  Text,
  SegmentedButtons,
  Menu,
  HelperText,
  List,
  Surface,
  Snackbar,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getSettings,
  getAllContracts,
  getAllProviders,
  createQuickBill,
  createBillForContract,
} from '../database/db';
import {
  CATEGORIES,
  CURRENCIES,
  type Category,
  type Contract,
  type Provider,
} from '../types';
import { toISODate, formatDate, formatCurrency } from '../utils/date';
import { parseISO } from 'date-fns';
import { DropdownField } from '../components/DropdownField';
import { CategoryIcon } from '../components/CategoryIcon';

type Mode = 'one-time' | 'from-contract';

export const AddBillScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const [mode, setMode] = useState<Mode>('one-time');
  const [language, setLanguage] = useState('en');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [snackbar, setSnackbar] = useState('');

  // One-time mode state
  const [providerName, setProviderName] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [categoryChosen, setCategoryChosen] = useState(false);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // From-contract mode state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Shared state
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CHF');
  const [dueDate, setDueDate] = useState(toISODate(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const [settings, contractList, providerList] = await Promise.all([
        getSettings(),
        getAllContracts(),
        getAllProviders(),
      ]);
      setLanguage(settings.language);
      setCurrency(settings.default_currency);
      setContracts(contractList);
      setProviders(providerList);
    };
    loadData();
  }, []);

  const filteredSuggestions = useMemo(() => {
    if (!providerName.trim()) return [];
    const query = providerName.toLowerCase();
    return providers.filter((p) => p.name.toLowerCase().includes(query));
  }, [providerName, providers]);

  const handleSelectProvider = (provider: Provider) => {
    setProviderName(provider.name);
    setCategory(provider.category);
    setCategoryChosen(true);
    setShowSuggestions(false);
  };

  const handleSelectContract = (contract: Contract) => {
    setSelectedContract(contract);
    setAmount(contract.amount.toString());
    setCurrency(contract.currency);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (mode === 'one-time') {
      if (!providerName.trim()) newErrors.providerName = t('common.required');
    } else {
      if (!selectedContract) newErrors.contract = t('common.required');
    }
    if (!amount.trim() || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      newErrors.amount = t('common.required');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (mode === 'one-time') {
        await createQuickBill({
          provider_name: providerName.trim(),
          category,
          amount: parseFloat(amount),
          currency,
          due_date: dueDate,
          notes: notes.trim() || null,
        });
        navigation.goBack();
      } else {
        if (!selectedContract) return;
        const billId = await createBillForContract(
          selectedContract.id,
          dueDate,
          parseFloat(amount),
          currency,
          notes.trim() || null,
        );
        if (billId === null) {
          setSnackbar(t('addBill.billExists'));
          setSaving(false);
          return;
        }
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error saving bill:', error);
    } finally {
      setSaving(false);
    }
  };

  const getCategoryIcon = (cat: Category): string => {
    return CATEGORIES.find((c) => c.key === cat)?.icon || 'dots-horizontal';
  };

  const isNewProvider = providerName.trim().length > 0 &&
    !providers.some((p) => p.name.toLowerCase() === providerName.trim().toLowerCase());

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('addBill.title')} />
      </Appbar.Header>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Mode Toggle */}
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => setMode(v as Mode)}
          buttons={[
            { value: 'one-time', label: t('addBill.oneTime') },
            { value: 'from-contract', label: t('addBill.fromContract') },
          ]}
          style={styles.segmented}
        />

        {mode === 'one-time' ? (
          <>
            {/* Provider Name with Autocomplete */}
            <View>
              <TextInput
                label={t('addBill.providerName')}
                value={providerName}
                onChangeText={(text) => {
                  setProviderName(text);
                  setShowSuggestions(true);
                  // Reset category choice when typing new text
                  if (categoryChosen) {
                    const match = providers.find(
                      (p) => p.name.toLowerCase() === text.toLowerCase()
                    );
                    if (!match) setCategoryChosen(false);
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder={t('addBill.providerNamePlaceholder')}
                mode="outlined"
                error={!!errors.providerName}
              />
              {errors.providerName && <HelperText type="error">{errors.providerName}</HelperText>}

              {showSuggestions && filteredSuggestions.length > 0 && (
                <Surface style={[styles.suggestions, { backgroundColor: theme.colors.elevation.level3 }]} elevation={3}>
                  {filteredSuggestions.slice(0, 5).map((provider) => (
                    <List.Item
                      key={provider.name}
                      title={provider.name}
                      description={t(`categories.${provider.category}`)}
                      left={() => <CategoryIcon category={provider.category} size={18} />}
                      onPress={() => handleSelectProvider(provider)}
                      style={styles.suggestionItem}
                    />
                  ))}
                </Surface>
              )}
            </View>

            {/* Category — shown when new provider or not yet selected */}
            {(isNewProvider || !categoryChosen) && providerName.trim().length > 0 && (
              <DropdownField
                label={t('addBill.selectCategory')}
                value={t(`categories.${category}`)}
                icon={getCategoryIcon(category)}
              >
                {(close) =>
                  CATEGORIES.map((cat) => (
                    <Menu.Item
                      key={cat.key}
                      leadingIcon={cat.icon}
                      title={t(`categories.${cat.key}`)}
                      onPress={() => {
                        setCategory(cat.key);
                        setCategoryChosen(true);
                        close();
                      }}
                    />
                  ))
                }
              </DropdownField>
            )}
          </>
        ) : (
          <>
            {/* Contract Picker */}
            <DropdownField
              label={t('addBill.selectContract')}
              value={selectedContract ? selectedContract.provider_name : ''}
              icon={selectedContract ? getCategoryIcon(selectedContract.category) : undefined}
              maxHeight={400}
            >
              {(close) =>
                contracts.map((contract) => (
                  <Menu.Item
                    key={contract.id}
                    leadingIcon={getCategoryIcon(contract.category)}
                    title={`${contract.provider_name}  ·  ${formatCurrency(contract.amount, contract.currency)}`}
                    onPress={() => {
                      handleSelectContract(contract);
                      close();
                    }}
                  />
                ))
              }
            </DropdownField>
            {errors.contract && <HelperText type="error">{errors.contract}</HelperText>}
          </>
        )}

        {/* Amount + Currency */}
        <View style={styles.row}>
          <View style={styles.amountInput}>
            <TextInput
              label={t('addBill.amount')}
              value={amount}
              onChangeText={setAmount}
              mode="outlined"
              keyboardType="decimal-pad"
              error={!!errors.amount}
            />
            {errors.amount && <HelperText type="error">{errors.amount}</HelperText>}
          </View>
          <View style={styles.currencyInput}>
            <DropdownField
              label={t('addBill.currency')}
              value={currency}
              maxHeight={300}
            >
              {(close) =>
                CURRENCIES.map((cur) => (
                  <Menu.Item
                    key={cur}
                    title={cur}
                    onPress={() => { setCurrency(cur); close(); }}
                  />
                ))
              }
            </DropdownField>
          </View>
        </View>

        {/* Due Date */}
        <Pressable onPress={() => setShowDatePicker(true)}>
          <View pointerEvents="none">
            <TextInput
              label={t('addBill.dueDate')}
              value={formatDate(dueDate, language)}
              mode="outlined"
              right={<TextInput.Icon icon="calendar" />}
              editable={false}
            />
          </View>
        </Pressable>

        {/* Notes */}
        <TextInput
          label={t('addBill.notes')}
          value={notes}
          onChangeText={setNotes}
          mode="outlined"
          multiline
          numberOfLines={3}
          placeholder={t('addBill.notesPlaceholder')}
        />

        {/* Save Button */}
        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
        >
          {t('common.save')}
        </Button>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={parseISO(dueDate)}
          mode="date"
          display="default"
          onChange={(_event, date) => {
            setShowDatePicker(false);
            if (date) setDueDate(toISODate(date));
          }}
        />
      )}

      <Snackbar
        visible={!!snackbar}
        onDismiss={() => setSnackbar('')}
        duration={3000}
      >
        {snackbar}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  segmented: {
    marginBottom: 4,
  },
  suggestions: {
    borderRadius: 8,
    marginTop: -8,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingVertical: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  amountInput: {
    flex: 2,
  },
  currencyInput: {
    flex: 1,
  },
  saveButton: {
    marginTop: 8,
  },
});
