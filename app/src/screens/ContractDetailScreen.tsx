import React, { useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Image, Alert } from 'react-native';
import {
  Appbar,
  Text,
  useTheme,
  Chip,
  List,
  Divider,
  Surface,
  Button,
  IconButton,
  Portal,
  Dialog,
  TextInput,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { launchDocumentScannerAsync, ResultFormatOptions } from '@infinitered/react-native-mlkit-document-scanner';
import { getContractById, getBillsForContract, getSettings, getContractDocuments, addContractDocument, deleteContractDocument } from '../database/db';
import { CategoryIcon } from '../components/CategoryIcon';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate, isOverdue } from '../utils/date';
import { statusColors } from '../theme';
import { saveProofFile, deleteProofFile, getProofFullPath } from '../services/exportImport';
import type { Contract, Bill, BillingCycle, ContractDocument } from '../types';
import { differenceInDays, parseISO, subDays } from 'date-fns';

type RouteParams = {
  ContractDetail: { contractId: string };
};

export const ContractDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'ContractDetail'>>();
  const { contractId } = route.params;

  const [contract, setContract] = useState<Contract | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [language, setLanguage] = useState('en');
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [nameDialogVisible, setNameDialogVisible] = useState(false);
  const [pendingDocUri, setPendingDocUri] = useState<string | null>(null);
  const [pendingDocType, setPendingDocType] = useState<'photo' | 'pdf'>('pdf');
  const [docName, setDocName] = useState('');

  const loadData = useCallback(async () => {
    const [c, b, s, docs] = await Promise.all([
      getContractById(contractId),
      getBillsForContract(contractId),
      getSettings(),
      getContractDocuments(contractId),
    ]);
    setContract(c);
    setBills(b);
    setLanguage(s.language);
    setDocuments(docs);
  }, [contractId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

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
      const result = await launchDocumentScannerAsync({
        pageLimit: 1,
        galleryImportAllowed: false,
        resultFormats: ResultFormatOptions.PDF,
      });
      if (result.canceled || !result.pdf?.uri) return;
      setPendingDocUri(result.pdf.uri);
      setPendingDocType('pdf');
      setDocName('');
      setNameDialogVisible(true);
    } catch {
      Alert.alert(t('common.error'), 'Document scanner not available');
    }
  };

  const handleOpenDocument = async (doc: ContractDocument) => {
    try {
      const fullPath = getProofFullPath(doc.path);
      const contentUri = await FileSystem.getContentUriAsync(fullPath);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/pdf',
      });
    } catch {
      Alert.alert(t('common.error'), 'Could not open document');
    }
  };

  const handleSaveDocument = async () => {
    if (!pendingDocUri || !docName.trim()) return;
    setNameDialogVisible(false);
    const ext = pendingDocType === 'pdf' ? 'pdf' : 'jpg';
    const id = Date.now().toString();
    const relativePath = await saveProofFile(pendingDocUri, `contract_${contractId}_${id}`, ext);
    await addContractDocument({
      contract_id: contractId,
      name: docName.trim(),
      type: pendingDocType,
      path: relativePath,
    });
    setPendingDocUri(null);
    setDocName('');
    loadData();
  };

  const handleDeleteDocument = async () => {
    if (!deleteDocId) return;
    const doc = documents.find((d) => d.id === deleteDocId);
    if (doc) {
      await deleteProofFile(doc.path);
      await deleteContractDocument(doc.id);
    }
    setDeleteDocId(null);
    loadData();
  };

  if (!contract) return null;

  const getCycleLabel = (cycle: BillingCycle): string => {
    switch (cycle) {
      case 'monthly': return t('contracts.perMonth');
      case 'quarterly': return t('contracts.perQuarter');
      case 'semi-annual': return t('contracts.perSemiAnnual');
      case 'annual': return t('contracts.perYear');
    }
  };

  const getExpiryWarning = () => {
    if (!contract.end_date) return null;
    const days = differenceInDays(parseISO(contract.end_date), new Date());
    if (days <= 90 && days > 0) {
      return t('contracts.expiresInDays', { days });
    }
    return null;
  };

  const getCancellationWarning = () => {
    if (!contract.end_date || !contract.cancellation_notice_days) return null;
    const cancellationDate = subDays(parseISO(contract.end_date), contract.cancellation_notice_days);
    const daysUntil = differenceInDays(cancellationDate, new Date());
    if (daysUntil <= 30 && daysUntil > 0) {
      return t('contracts.cancellationWarning', { date: formatDate(cancellationDate.toISOString().split('T')[0], language) });
    }
    return null;
  };

  const expiryWarning = getExpiryWarning();
  const cancellationWarning = getCancellationWarning();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={contract.provider_name} />
        <Appbar.Action
          icon="pencil"
          onPress={() => navigation.navigate('EditContract', { contractId })}
        />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Contract Info Card */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
          <View style={styles.headerRow}>
            <CategoryIcon category={contract.category} size={28} />
            <View style={styles.headerText}>
              <Text variant="headlineSmall">{contract.provider_name}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {t(`categories.${contract.category}`)}
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.detailRow}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('contracts.amount')}
            </Text>
            <Text variant="titleMedium">
              {formatCurrency(contract.amount, contract.currency)} {getCycleLabel(contract.billing_cycle)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('contracts.billingDay')}
            </Text>
            <Text variant="bodyLarge">{contract.billing_day}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('contracts.startDate')}
            </Text>
            <Text variant="bodyLarge">{formatDate(contract.start_date, language)}</Text>
          </View>

          {contract.end_date && (
            <View style={styles.detailRow}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('contracts.endDate')}
              </Text>
              <View style={styles.rowRight}>
                <Text variant="bodyLarge">{formatDate(contract.end_date, language)}</Text>
                {expiryWarning && (
                  <Chip compact textStyle={{ fontSize: 11, color: statusColors.dueSoon }}>
                    {expiryWarning}
                  </Chip>
                )}
              </View>
            </View>
          )}

          {cancellationWarning && (
            <Chip
              icon="alert"
              style={[styles.warningChip, { backgroundColor: statusColors.dueSoon + '20' }]}
              textStyle={{ color: statusColors.dueSoon }}
            >
              {cancellationWarning}
            </Chip>
          )}

          {contract.cancellation_notice_days != null && (
            <View style={styles.detailRow}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('contracts.cancellationNoticeDays')}
              </Text>
              <Text variant="bodyLarge">{contract.cancellation_notice_days}</Text>
            </View>
          )}

          {contract.payment_method && (
            <View style={styles.detailRow}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('contracts.paymentMethod')}
              </Text>
              <Text variant="bodyLarge">{t(`paymentMethods.${contract.payment_method}`)}</Text>
            </View>
          )}

          {contract.notes && (
            <View style={styles.notesSection}>
              <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                {t('contracts.notes')}
              </Text>
              <Text variant="bodyMedium" style={{ marginTop: 4 }}>{contract.notes}</Text>
            </View>
          )}
        </Surface>

        {/* Documents Section */}
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">{t('contracts.documents')} ({documents.length})</Text>
        </View>

        <Surface style={[styles.card, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
          {documents.length === 0 ? (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 8 }}>
              {t('contracts.noDocuments')}
            </Text>
          ) : (
            documents.map((doc, index) => (
              <View key={doc.id}>
                {index > 0 && <Divider />}
                <List.Item
                  title={doc.name}
                  description="PDF"
                  left={(props) => <List.Icon {...props} icon="file-pdf-box" />}
                  right={() => (
                    <IconButton
                      icon="delete-outline"
                      size={20}
                      onPress={() => setDeleteDocId(doc.id)}
                      iconColor={theme.colors.error}
                    />
                  )}
                  onPress={() => handleOpenDocument(doc)}
                />
              </View>
            ))
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

        {/* Bills List */}
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">{t('bills.title')} ({bills.length})</Text>
        </View>

        {bills.map((bill) => (
          <List.Item
            key={bill.id}
            title={formatDate(bill.due_date, language)}
            description={formatCurrency(bill.amount, bill.currency)}
            left={() => (
              <View style={styles.billStatusDot}>
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        bill.status === 'paid'
                          ? statusColors.paid
                          : isOverdue(bill.due_date)
                            ? statusColors.overdue
                            : statusColors.pending,
                    },
                  ]}
                />
              </View>
            )}
            right={() => <StatusBadge status={bill.status} dueDate={bill.due_date} />}
            onPress={() => navigation.navigate('BillDetail', { billId: bill.id })}
          />
        ))}
      </ScrollView>

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
            <Button onPress={handleSaveDocument} disabled={!docName.trim()}>{t('common.save')}</Button>
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
            <Button onPress={handleDeleteDocument} textColor={theme.colors.error}>{t('common.delete')}</Button>
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
    gap: 4,
  },
  warningChip: {
    alignSelf: 'flex-start',
  },
  notesSection: {
    marginTop: 4,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
  },
  docButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  billStatusDot: {
    justifyContent: 'center',
    marginLeft: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
