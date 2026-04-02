import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Alert } from 'react-native';
import {
  TextInput,
  Button,
  Switch,
  Menu,
  Portal,
  Dialog,
  useTheme,
  Appbar,
  Text,
  Divider,
  HelperText,
  List,
  IconButton,
  Surface,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getSettings,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
  getBillsForContract,
  getContractDocuments,
  addContractDocument,
  deleteContractDocument,
} from '../database/db';
import { generateBillsForContract } from '../services/billGeneration';
import { deleteProofFile, saveProofFile } from '../services/exportImport';
import {
  CATEGORIES,
  CURRENCIES,
  type Category,
  type BillingCycle,
  type PaymentMethod,
  type ContractDocument,
} from '../types';
import { toISODate, formatDate } from '../utils/date';
import { parseISO } from 'date-fns';

type RouteParams = {
  AddEditContract: { contractId?: string };
};

const PAYMENT_METHODS: { key: PaymentMethod; labelKey: string }[] = [
  { key: 'direct_debit', labelKey: 'paymentMethods.direct_debit' },
  { key: 'bank_transfer', labelKey: 'paymentMethods.bank_transfer' },
  { key: 'credit_card', labelKey: 'paymentMethods.credit_card' },
  { key: 'cash', labelKey: 'paymentMethods.cash' },
  { key: 'other', labelKey: 'paymentMethods.other' },
];

const BILLING_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

interface PendingDocument {
  uri: string;
  name: string;
  type: 'photo' | 'pdf';
}

export const AddEditContractScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'AddEditContract'>>();
  const contractId = route.params?.contractId;
  const isEditing = !!contractId;

  // Form state
  const [providerName, setProviderName] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CHF');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [billingDay, setBillingDay] = useState(1);
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [cancellationNoticeDays, setCancellationNoticeDays] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [notes, setNotes] = useState('');
  const [language, setLanguage] = useState('en');

  // UI state
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [currencyMenuVisible, setCurrencyMenuVisible] = useState(false);
  const [billingCycleMenuVisible, setBillingCycleMenuVisible] = useState(false);
  const [billingDayMenuVisible, setBillingDayMenuVisible] = useState(false);
  const [paymentMethodMenuVisible, setPaymentMethodMenuVisible] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Document state
  const [existingDocs, setExistingDocs] = useState<ContractDocument[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [nameDialogVisible, setNameDialogVisible] = useState(false);
  const [pendingDocUri, setPendingDocUri] = useState<string | null>(null);
  const [pendingDocType, setPendingDocType] = useState<'photo' | 'pdf'>('pdf');
  const [docName, setDocName] = useState('');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const settings = await getSettings();
      setLanguage(settings.language);
      if (!isEditing) {
        setCurrency(settings.default_currency);
      }

      if (contractId) {
        const [contract, docs] = await Promise.all([
          getContractById(contractId),
          getContractDocuments(contractId),
        ]);
        if (contract) {
          setProviderName(contract.provider_name);
          setCategory(contract.category);
          setAmount(contract.amount.toString());
          setCurrency(contract.currency);
          setBillingCycle(contract.billing_cycle);
          setBillingDay(contract.billing_day);
          setStartDate(contract.start_date);
          if (contract.end_date) {
            setHasEndDate(true);
            setEndDate(contract.end_date);
          }
          if (contract.cancellation_notice_days != null) {
            setCancellationNoticeDays(contract.cancellation_notice_days.toString());
          }
          setPaymentMethod(contract.payment_method);
          setNotes(contract.notes || '');
        }
        setExistingDocs(docs);
      }
    };
    loadData();
  }, [contractId, isEditing]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!providerName.trim()) newErrors.providerName = t('common.required');
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
      const contractData = {
        provider_name: providerName.trim(),
        category,
        amount: parseFloat(amount),
        currency,
        billing_cycle: billingCycle,
        billing_day: billingDay,
        start_date: startDate,
        end_date: hasEndDate && endDate ? endDate : null,
        cancellation_notice_days: hasEndDate && cancellationNoticeDays
          ? parseInt(cancellationNoticeDays, 10)
          : null,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
      };

      let savedId: string;
      if (isEditing && contractId) {
        await updateContract(contractId, contractData);
        savedId = contractId;
      } else {
        savedId = await createContract(contractData);
      }

      // Save pending documents
      for (const doc of pendingDocs) {
        const ext = doc.type === 'pdf' ? 'pdf' : 'jpg';
        const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
        const relativePath = await saveProofFile(doc.uri, `contract_${savedId}_${id}`, ext);
        await addContractDocument({
          contract_id: savedId,
          name: doc.name,
          type: doc.type,
          path: relativePath,
        });
      }

      const contract = await getContractById(savedId);
      if (contract) {
        await generateBillsForContract(contract);
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error saving contract:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!contractId) return;
    setDeleteDialogVisible(false);
    try {
      const bills = await getBillsForContract(contractId);
      for (const bill of bills) {
        if (bill.proof_path) {
          await deleteProofFile(bill.proof_path);
        }
      }
      for (const doc of existingDocs) {
        await deleteProofFile(doc.path);
      }
      await deleteContract(contractId);
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting contract:', error);
    }
  };

  // Document handlers
  const handleImportPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPendingDocUri(asset.uri);
    setPendingDocType('pdf');
    setDocName(asset.name?.replace(/\.pdf$/i, '') || '');
    setNameDialogVisible(true);
  };

  const handleScanDocument = async () => {
    try {
      const { launchCameraAsync, requestCameraPermissionsAsync } = await import('expo-image-picker');
      const { status } = await requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      const result = await launchCameraAsync({ quality: 0.85, allowsEditing: true });
      if (result.canceled) return;
      setPendingDocUri(result.assets[0].uri);
      setPendingDocType('photo');
      setDocName('');
      setNameDialogVisible(true);
    } catch {
      Alert.alert(t('common.error'), 'Camera not available');
    }
  };

  const handleConfirmDocName = async () => {
    if (!pendingDocUri || !docName.trim()) return;
    setNameDialogVisible(false);

    if (isEditing && contractId) {
      const ext = pendingDocType === 'pdf' ? 'pdf' : 'jpg';
      const id = Date.now().toString();
      const relativePath = await saveProofFile(pendingDocUri, `contract_${contractId}_${id}`, ext);
      await addContractDocument({
        contract_id: contractId,
        name: docName.trim(),
        type: pendingDocType,
        path: relativePath,
      });
      const docs = await getContractDocuments(contractId);
      setExistingDocs(docs);
    } else {
      setPendingDocs((prev) => [...prev, { uri: pendingDocUri!, name: docName.trim(), type: pendingDocType }]);
    }

    setPendingDocUri(null);
    setDocName('');
  };

  const handleDeleteExistingDoc = async () => {
    if (!deleteDocId) return;
    const doc = existingDocs.find((d) => d.id === deleteDocId);
    if (doc) {
      await deleteProofFile(doc.path);
      await deleteContractDocument(doc.id);
      setExistingDocs((prev) => prev.filter((d) => d.id !== deleteDocId));
    }
    setDeleteDocId(null);
  };

  const handleRemovePendingDoc = (index: number) => {
    setPendingDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const getCategoryIcon = (cat: Category): string => {
    return CATEGORIES.find((c) => c.key === cat)?.icon || 'dots-horizontal';
  };

  const getBillingCycleLabel = (cycle: BillingCycle): string => {
    return t(`billingCycles.${cycle}`);
  };

  const totalDocs = existingDocs.length + pendingDocs.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isEditing ? t('contracts.editContract') : t('contracts.addContract')} />
      </Appbar.Header>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Provider Name */}
        <TextInput
          label={t('contracts.providerName')}
          value={providerName}
          onChangeText={setProviderName}
          placeholder={t('contracts.providerNamePlaceholder')}
          mode="outlined"
          error={!!errors.providerName}
        />
        {errors.providerName && <HelperText type="error">{errors.providerName}</HelperText>}

        {/* Category */}
        <Menu
          visible={categoryMenuVisible}
          onDismiss={() => setCategoryMenuVisible(false)}
          anchor={
            <TextInput
              label={t('contracts.category')}
              value={t(`categories.${category}`)}
              mode="outlined"
              right={<TextInput.Icon icon="chevron-down" onPress={() => setCategoryMenuVisible(true)} />}
              left={<TextInput.Icon icon={getCategoryIcon(category)} />}
              editable={false}
              onPressIn={() => setCategoryMenuVisible(true)}
            />
          }
        >
          {CATEGORIES.map((cat) => (
            <Menu.Item
              key={cat.key}
              leadingIcon={cat.icon}
              title={t(`categories.${cat.key}`)}
              onPress={() => {
                setCategory(cat.key);
                setCategoryMenuVisible(false);
              }}
            />
          ))}
        </Menu>

        {/* Amount + Currency row */}
        <View style={styles.row}>
          <View style={styles.amountInput}>
            <TextInput
              label={t('contracts.amount')}
              value={amount}
              onChangeText={setAmount}
              mode="outlined"
              keyboardType="decimal-pad"
              error={!!errors.amount}
            />
            {errors.amount && <HelperText type="error">{errors.amount}</HelperText>}
          </View>
          <View style={styles.currencyInput}>
            <Menu
              visible={currencyMenuVisible}
              onDismiss={() => setCurrencyMenuVisible(false)}
              anchor={
                <TextInput
                  label={t('contracts.currency')}
                  value={currency}
                  mode="outlined"
                  right={<TextInput.Icon icon="chevron-down" onPress={() => setCurrencyMenuVisible(true)} />}
                  editable={false}
                  onPressIn={() => setCurrencyMenuVisible(true)}
                />
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
        </View>

        {/* Billing Cycle */}
        <Menu
          visible={billingCycleMenuVisible}
          onDismiss={() => setBillingCycleMenuVisible(false)}
          anchor={
            <TextInput
              label={t('contracts.billingCycle')}
              value={getBillingCycleLabel(billingCycle)}
              mode="outlined"
              right={<TextInput.Icon icon="chevron-down" onPress={() => setBillingCycleMenuVisible(true)} />}
              editable={false}
              onPressIn={() => setBillingCycleMenuVisible(true)}
            />
          }
        >
          {(['monthly', 'quarterly', 'semi-annual', 'annual'] as BillingCycle[]).map((bc) => (
            <Menu.Item
              key={bc}
              title={getBillingCycleLabel(bc)}
              onPress={() => {
                setBillingCycle(bc);
                setBillingCycleMenuVisible(false);
              }}
            />
          ))}
        </Menu>

        {/* Billing Day */}
        <Menu
          visible={billingDayMenuVisible}
          onDismiss={() => setBillingDayMenuVisible(false)}
          anchor={
            <TextInput
              label={t('contracts.billingDay')}
              value={billingDay.toString()}
              mode="outlined"
              right={<TextInput.Icon icon="chevron-down" onPress={() => setBillingDayMenuVisible(true)} />}
              editable={false}
              onPressIn={() => setBillingDayMenuVisible(true)}
            />
          }
        >
          <ScrollView style={{ maxHeight: 300 }}>
            {BILLING_DAY_OPTIONS.map((day) => (
              <Menu.Item
                key={day}
                title={day.toString()}
                onPress={() => {
                  setBillingDay(day);
                  setBillingDayMenuVisible(false);
                }}
              />
            ))}
          </ScrollView>
        </Menu>

        {/* Start Date — tapping the field opens native date picker popup */}
        <Pressable onPress={() => setShowStartPicker(true)}>
          <View pointerEvents="none">
            <TextInput
              label={t('contracts.startDate')}
              value={startDate ? formatDate(startDate, language) : ''}
              mode="outlined"
              right={<TextInput.Icon icon="calendar" />}
              editable={false}
            />
          </View>
        </Pressable>

        {/* End Date Toggle */}
        <View style={styles.switchRow}>
          <Text variant="bodyLarge">{t('contracts.hasEndDate')}</Text>
          <Switch value={hasEndDate} onValueChange={setHasEndDate} />
        </View>

        {hasEndDate && (
          <>
            <Pressable onPress={() => setShowEndPicker(true)}>
              <View pointerEvents="none">
                <TextInput
                  label={t('contracts.endDate')}
                  value={endDate ? formatDate(endDate, language) : ''}
                  mode="outlined"
                  right={<TextInput.Icon icon="calendar" />}
                  editable={false}
                />
              </View>
            </Pressable>

            <TextInput
              label={t('contracts.cancellationNoticeDays')}
              value={cancellationNoticeDays}
              onChangeText={setCancellationNoticeDays}
              mode="outlined"
              keyboardType="number-pad"
            />
          </>
        )}

        {/* Payment Method */}
        <Menu
          visible={paymentMethodMenuVisible}
          onDismiss={() => setPaymentMethodMenuVisible(false)}
          anchor={
            <TextInput
              label={t('contracts.paymentMethod')}
              value={paymentMethod ? t(`paymentMethods.${paymentMethod}`) : ''}
              mode="outlined"
              right={<TextInput.Icon icon="chevron-down" onPress={() => setPaymentMethodMenuVisible(true)} />}
              editable={false}
              onPressIn={() => setPaymentMethodMenuVisible(true)}
              placeholder={t('common.optional')}
            />
          }
        >
          <Menu.Item
            title={`— ${t('common.remove')} —`}
            onPress={() => {
              setPaymentMethod(null);
              setPaymentMethodMenuVisible(false);
            }}
          />
          <Divider />
          {PAYMENT_METHODS.map((pm) => (
            <Menu.Item
              key={pm.key!}
              title={t(pm.labelKey)}
              onPress={() => {
                setPaymentMethod(pm.key);
                setPaymentMethodMenuVisible(false);
              }}
            />
          ))}
        </Menu>

        {/* Notes */}
        <TextInput
          label={t('contracts.notes')}
          value={notes}
          onChangeText={setNotes}
          mode="outlined"
          multiline
          numberOfLines={3}
          placeholder={t('contracts.notesPlaceholder')}
        />

        {/* Documents Section */}
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">{t('contracts.documents')} ({totalDocs})</Text>
        </View>

        <Surface style={[styles.docCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
          {totalDocs === 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 8 }}>
              {t('contracts.noDocuments')}
            </Text>
          ) : (
            <>
              {existingDocs.map((doc, index) => (
                <View key={doc.id}>
                  {index > 0 && <Divider />}
                  <List.Item
                    title={doc.name}
                    description={doc.type === 'pdf' ? 'PDF' : 'Photo'}
                    left={(props) => <List.Icon {...props} icon={doc.type === 'pdf' ? 'file-pdf-box' : 'image'} />}
                    right={() => (
                      <IconButton
                        icon="delete-outline"
                        size={20}
                        onPress={() => setDeleteDocId(doc.id)}
                        iconColor={theme.colors.error}
                      />
                    )}
                  />
                </View>
              ))}
              {pendingDocs.map((doc, index) => (
                <View key={`pending-${index}`}>
                  {(existingDocs.length > 0 || index > 0) && <Divider />}
                  <List.Item
                    title={doc.name}
                    description={doc.type === 'pdf' ? 'PDF' : 'Photo'}
                    left={(props) => <List.Icon {...props} icon={doc.type === 'pdf' ? 'file-pdf-box' : 'image'} />}
                    right={() => (
                      <IconButton
                        icon="close"
                        size={20}
                        onPress={() => handleRemovePendingDoc(index)}
                        iconColor={theme.colors.onSurfaceVariant}
                      />
                    )}
                  />
                </View>
              ))}
            </>
          )}
          <Divider style={{ marginTop: 4 }} />
          <View style={styles.docButtons}>
            <Button mode="text" icon="camera" onPress={handleScanDocument} compact>
              {t('contracts.scanDocument')}
            </Button>
            <Button mode="text" icon="file-pdf-box" onPress={handleImportPdf} compact>
              {t('contracts.importPdf')}
            </Button>
          </View>
        </Surface>

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

        {/* Delete Button (edit mode only) */}
        {isEditing && (
          <Button
            mode="outlined"
            onPress={() => setDeleteDialogVisible(true)}
            textColor={theme.colors.error}
            style={styles.deleteButton}
          >
            {t('contracts.deleteContract')}
          </Button>
        )}
      </ScrollView>

      {/* Native Date Pickers — compact popup dialog on Android */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate ? parseISO(startDate) : new Date()}
          mode="date"
          display="default"
          onChange={(_event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) setStartDate(toISODate(selectedDate));
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate ? parseISO(endDate) : new Date()}
          mode="date"
          display="default"
          onChange={(_event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) setEndDate(toISODate(selectedDate));
          }}
        />
      )}

      <Portal>
        {/* Document name dialog */}
        <Dialog visible={nameDialogVisible} onDismiss={() => setNameDialogVisible(false)}>
          <Dialog.Title>{t('contracts.documentName')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              value={docName}
              onChangeText={setDocName}
              mode="outlined"
              placeholder={t('contracts.enterDocumentName')}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setNameDialogVisible(false); setPendingDocUri(null); }}>{t('common.cancel')}</Button>
            <Button onPress={handleConfirmDocName} disabled={!docName.trim()}>{t('common.save')}</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Delete document confirmation */}
        <Dialog visible={!!deleteDocId} onDismiss={() => setDeleteDocId(null)}>
          <Dialog.Title>{t('contracts.deleteDocument')}</Dialog.Title>
          <Dialog.Content>
            <Text>{t('contracts.deleteDocumentConfirm')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDocId(null)}>{t('common.cancel')}</Button>
            <Button onPress={handleDeleteExistingDoc} textColor={theme.colors.error}>{t('common.delete')}</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Delete contract confirmation */}
        <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
          <Dialog.Title>{t('contracts.deleteContract')}</Dialog.Title>
          <Dialog.Content>
            <Text>{t('contracts.deleteConfirm')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleDelete} textColor={theme.colors.error}>{t('common.delete')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sectionHeader: {
    marginTop: 8,
  },
  docCard: {
    borderRadius: 12,
    padding: 12,
  },
  docButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  saveButton: {
    marginTop: 8,
  },
  deleteButton: {
    marginTop: 8,
  },
});
