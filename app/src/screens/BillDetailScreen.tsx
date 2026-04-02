import React, { useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Image, Alert, Dimensions, Pressable } from 'react-native';
import {
  Appbar,
  Button,
  Card,
  Text,
  useTheme,
  Surface,
  Divider,
  IconButton,
  Portal,
  Dialog,
  TextInput,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { launchDocumentScannerAsync, ResultFormatOptions } from '@infinitered/react-native-mlkit-document-scanner';
import { getBillById, markBillAsPaid, markBillAsUnpaid, updateBillProof, updateBillNotes, updateBillAmount, getSettings } from '../database/db';
import { saveProofFile, deleteProofFile, proofFileExists, getProofFullPath } from '../services/exportImport';
import { cancelBillNotifications } from '../services/notifications';
import { CategoryIcon } from '../components/CategoryIcon';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate, getDueDateLabel, toISODate } from '../utils/date';
import { statusColors } from '../theme';
import type { BillWithContract } from '../types';
import { parseISO } from 'date-fns';

type RouteParams = {
  BillDetail: { billId: string };
};

const screenWidth = Dimensions.get('window').width;

export const BillDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'BillDetail'>>();
  const { billId } = route.params;

  const [bill, setBill] = useState<BillWithContract | null>(null);
  const [language, setLanguage] = useState('en');
  const [proofExists, setProofExists] = useState(false);
  const [removeProofDialogVisible, setRemoveProofDialogVisible] = useState(false);
  const [notesDialogVisible, setNotesDialogVisible] = useState(false);
  const [paidDateDialogVisible, setPaidDateDialogVisible] = useState(false);
  const [showPaidDatePicker, setShowPaidDatePicker] = useState(false);
  const [selectedPaidDate, setSelectedPaidDate] = useState(toISODate(new Date()));
  const [notesInput, setNotesInput] = useState('');
  const [amountDialogVisible, setAmountDialogVisible] = useState(false);
  const [amountInput, setAmountInput] = useState('');

  const loadData = useCallback(async () => {
    const [b, s] = await Promise.all([getBillById(billId), getSettings()]);
    setBill(b);
    setLanguage(s.language);
    if (b?.proof_path) {
      const exists = await proofFileExists(b.proof_path);
      setProofExists(exists);
    } else {
      setProofExists(false);
    }
  }, [billId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openMarkAsPaidDialog = () => {
    setSelectedPaidDate(toISODate(new Date()));
    setPaidDateDialogVisible(true);
  };

  const handleMarkAsPaid = async () => {
    if (!bill) return;
    setPaidDateDialogVisible(false);
    await markBillAsPaid(bill.id, selectedPaidDate);
    await cancelBillNotifications(bill.id);
    loadData();
  };

  const handleUndoPayment = async () => {
    if (!bill) return;
    await markBillAsUnpaid(bill.id);
    loadData();
  };

  const handleImportPdf = async () => {
    if (!bill) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    const relativePath = await saveProofFile(uri, bill.id, 'pdf');
    await updateBillProof(bill.id, 'pdf', relativePath);
    loadData();
  };

  const handleScanDocument = async () => {
    if (!bill) return;
    try {
      const result = await launchDocumentScannerAsync({
        pageLimit: 1,
        galleryImportAllowed: false,
        resultFormats: ResultFormatOptions.PDF,
      });
      if (result.canceled || !result.pdf?.uri) return;
      const relativePath = await saveProofFile(result.pdf.uri, bill.id, 'pdf');
      await updateBillProof(bill.id, 'pdf', relativePath);
      loadData();
    } catch {
      Alert.alert(t('common.error'), 'Document scanner not available');
    }
  };

  const handleOpenProof = async () => {
    if (!bill?.proof_path) return;

    try {
      const fullPath = getProofFullPath(bill.proof_path);
      const contentUri = await FileSystem.getContentUriAsync(fullPath);
      const mimeType = bill.proof_type === 'pdf' ? 'application/pdf' : 'image/jpeg';

      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: mimeType,
      });
    } catch {
      Alert.alert(t('common.error'), t('bills.proofNotFound'));
    }
  };

  const handleRemoveProof = async () => {
    if (!bill?.proof_path) return;
    setRemoveProofDialogVisible(false);
    await deleteProofFile(bill.proof_path);
    await updateBillProof(bill.id, null, null);
    loadData();
  };

  const handleSaveNotes = async () => {
    if (!bill) return;
    setNotesDialogVisible(false);
    await updateBillNotes(bill.id, notesInput.trim() || null);
    loadData();
  };

  const handleSaveAmount = async () => {
    if (!bill) return;
    const newAmount = parseFloat(amountInput);
    if (isNaN(newAmount) || newAmount <= 0) return;
    setAmountDialogVisible(false);
    await updateBillAmount(bill.id, newAmount);
    loadData();
  };

  if (!bill) return null;

  const proofFullPath = bill.proof_path ? getProofFullPath(bill.proof_path) : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('bills.title')} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Bill Info Card */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
          <View style={styles.headerRow}>
            <CategoryIcon category={bill.category} size={28} />
            <View style={styles.headerText}>
              {bill.contract_id ? (
                <>
                  <Text
                    variant="headlineSmall"
                    onPress={() => navigation.navigate('ContractDetail', { contractId: bill.contract_id })}
                    style={{ color: theme.colors.primary }}
                  >
                    {bill.provider_name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.primary }}>
                    {t('bills.viewContract')} →
                  </Text>
                </>
              ) : (
                <Text variant="headlineSmall">
                  {bill.provider_name}
                </Text>
              )}
            </View>
          </View>

          <Divider style={styles.divider} />

          <Pressable
            onPress={() => {
              setAmountInput(bill.amount.toString());
              setAmountDialogVisible(true);
            }}
            style={styles.detailRow}
          >
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('bills.amount')}
            </Text>
            <View style={styles.rowRight}>
              <View style={styles.amountRow}>
                <Text variant="titleLarge">{formatCurrency(bill.amount, bill.currency)}</Text>
                <IconButton icon="pencil-outline" size={16} style={styles.editIcon} />
              </View>
              {bill.contract_amount != null && bill.amount !== bill.contract_amount && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t('bills.contractDefault', { amount: formatCurrency(bill.contract_amount, bill.currency) })}
                </Text>
              )}
            </View>
          </Pressable>

          <View style={styles.detailRow}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('bills.dueDate')}
            </Text>
            <View style={styles.rowRight}>
              <Text variant="bodyLarge">{formatDate(bill.due_date, language)}</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {getDueDateLabel(bill.due_date, t)}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('bills.status')}
            </Text>
            <StatusBadge status={bill.status} dueDate={bill.due_date} />
          </View>

          {bill.paid_date && (
            <View style={styles.detailRow}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('bills.paidOn', { date: '' })}
              </Text>
              <Text variant="bodyLarge" style={{ color: statusColors.paid }}>
                {formatDate(bill.paid_date, language)}
              </Text>
            </View>
          )}

          {bill.notes && (
            <View style={styles.notesSection}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('bills.billNotes')}
              </Text>
              <Text variant="bodyMedium" style={{ marginTop: 4 }}>{bill.notes}</Text>
            </View>
          )}

          <Button
            icon="note-edit"
            mode="text"
            onPress={() => {
              setNotesInput(bill.notes || '');
              setNotesDialogVisible(true);
            }}
            compact
          >
            {bill.notes ? t('common.edit') : t('common.add')} {t('bills.billNotes')}
          </Button>
        </Surface>

        {/* Payment Action */}
        {bill.status === 'pending' ? (
          <Button
            mode="contained"
            icon="check-circle"
            onPress={openMarkAsPaidDialog}
            style={styles.actionButton}
            buttonColor={statusColors.paid}
            textColor="#FFFFFF"
          >
            {t('bills.markAsPaid')}
          </Button>
        ) : (
          <Button
            mode="outlined"
            icon="undo"
            onPress={handleUndoPayment}
            style={styles.actionButton}
          >
            {t('bills.undoPayment')}
          </Button>
        )}

        {/* Proof Section */}
        <Text variant="titleMedium" style={styles.sectionTitle}>{t('bills.proof')}</Text>

        {bill.proof_path && proofExists ? (
          <Surface style={[styles.proofCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
            {bill.proof_type === 'photo' && proofFullPath && (
              <Image
                source={{ uri: proofFullPath }}
                style={styles.proofImage}
                resizeMode="contain"
              />
            )}
            {bill.proof_type === 'pdf' && (
              <Pressable onPress={handleOpenProof} style={styles.pdfPlaceholder}>
                <IconButton icon="file-pdf-box" size={48} />
                <Text variant="bodyMedium">PDF</Text>
              </Pressable>
            )}
            <View style={styles.proofActions}>
              <Button
                mode="text"
                icon="swap-horizontal"
                onPress={handleImportPdf}
                compact
              >
                {t('bills.replaceProof')}
              </Button>
              <Button
                mode="text"
                icon="delete"
                onPress={() => setRemoveProofDialogVisible(true)}
                textColor={theme.colors.error}
                compact
              >
                {t('bills.removeProof')}
              </Button>
            </View>
          </Surface>
        ) : bill.proof_path && !proofExists ? (
          <Surface style={[styles.proofCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
            <View style={styles.proofNotFound}>
              <IconButton icon="file-alert" size={48} />
              <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
                {t('bills.proofNotFound')}
              </Text>
            </View>
          </Surface>
        ) : (
          <Surface style={[styles.proofCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
            <View style={styles.addProofContainer}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                {t('bills.addProof')}
              </Text>
              <View style={styles.proofButtons}>
                <Button mode="outlined" icon="camera" onPress={handleScanDocument} style={styles.proofButton}>
                  {t('bills.scanDocument')}
                </Button>
                <Button mode="outlined" icon="file-pdf-box" onPress={handleImportPdf} style={styles.proofButton}>
                  {t('bills.importPdf')}
                </Button>
              </View>
            </View>
          </Surface>
        )}
      </ScrollView>

      {showPaidDatePicker && (
        <DateTimePicker
          value={parseISO(selectedPaidDate)}
          mode="date"
          display="default"
          onChange={(_event, date) => {
            setShowPaidDatePicker(false);
            if (date) {
              setSelectedPaidDate(toISODate(date));
            }
          }}
        />
      )}

      <Portal>
        <Dialog visible={paidDateDialogVisible} onDismiss={() => setPaidDateDialogVisible(false)}>
          <Dialog.Title>{t('bills.markAsPaid')}</Dialog.Title>
          <Dialog.Content>
            <Pressable onPress={() => setShowPaidDatePicker(true)}>
              <View pointerEvents="none">
                <TextInput
                  label={t('bills.paymentDate')}
                  value={formatDate(selectedPaidDate, language)}
                  mode="outlined"
                  right={<TextInput.Icon icon="calendar" />}
                  editable={false}
                />
              </View>
            </Pressable>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPaidDateDialogVisible(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleMarkAsPaid}>{t('common.confirm')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={removeProofDialogVisible} onDismiss={() => setRemoveProofDialogVisible(false)}>
          <Dialog.Title>{t('bills.removeProof')}</Dialog.Title>
          <Dialog.Content>
            <Text>{t('bills.removeProofConfirm')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRemoveProofDialogVisible(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleRemoveProof} textColor={theme.colors.error}>{t('common.remove')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={notesDialogVisible} onDismiss={() => setNotesDialogVisible(false)}>
          <Dialog.Title>{t('bills.billNotes')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              value={notesInput}
              onChangeText={setNotesInput}
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder={t('bills.notesPlaceholder')}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setNotesDialogVisible(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleSaveNotes}>{t('common.save')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={amountDialogVisible} onDismiss={() => setAmountDialogVisible(false)}>
          <Dialog.Title>{t('bills.editAmount')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              mode="outlined"
              keyboardType="decimal-pad"
              label={t('bills.newAmount')}
              autoFocus
            />
            {bill?.contract_amount != null && (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                {t('bills.contractDefault', { amount: formatCurrency(bill.contract_amount, bill.currency) })}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAmountDialogVisible(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleSaveAmount}>{t('common.save')}</Button>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  divider: {
    marginVertical: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  notesSection: {
    marginTop: 4,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editIcon: {
    margin: 0,
    marginLeft: -4,
  },
  actionButton: {
    marginTop: 16,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 8,
  },
  proofCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  proofImage: {
    width: screenWidth - 32,
    height: 400,
  },
  pdfPlaceholder: {
    padding: 32,
    alignItems: 'center',
  },
  proofNotFound: {
    padding: 32,
    alignItems: 'center',
  },
  proofActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 8,
  },
  addProofContainer: {
    padding: 24,
    alignItems: 'center',
  },
  proofButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  proofButton: {
    flex: 1,
  },
});
