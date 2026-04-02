import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import JSZip from 'jszip';
import {
  getSettings,
  getAllContracts,
  getAllBills,
  getAllContractDocuments,
  clearAllData,
  updateSettings,
  bulkInsertContracts,
  bulkInsertBills,
  bulkInsertContractDocuments,
} from '../database/db';
import { generateAllBills } from './billGeneration';
import type { ExportData } from '../types';
import { toISODateTime } from '../utils/date';

const PROOFS_DIR = `${FileSystem.documentDirectory}proofs/`;

const ensureProofsDir = async () => {
  const dirInfo = await FileSystem.getInfoAsync(PROOFS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PROOFS_DIR, { intermediates: true });
  }
};

export const getProofFilePath = (billId: string, ext: string): string => {
  return `${PROOFS_DIR}${billId}.${ext}`;
};

export const getProofRelativePath = (billId: string, ext: string): string => {
  return `proofs/${billId}.${ext}`;
};

export const saveProofFile = async (
  sourceUri: string,
  billId: string,
  ext: string
): Promise<string> => {
  await ensureProofsDir();
  const destPath = getProofFilePath(billId, ext);
  await FileSystem.copyAsync({ from: sourceUri, to: destPath });
  return getProofRelativePath(billId, ext);
};

export const deleteProofFile = async (relativePath: string): Promise<void> => {
  const fullPath = `${FileSystem.documentDirectory}${relativePath}`;
  const fileInfo = await FileSystem.getInfoAsync(fullPath);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(fullPath);
  }
};

export const proofFileExists = async (relativePath: string): Promise<boolean> => {
  const fullPath = `${FileSystem.documentDirectory}${relativePath}`;
  const fileInfo = await FileSystem.getInfoAsync(fullPath);
  return fileInfo.exists;
};

export const getProofFullPath = (relativePath: string): string => {
  return `${FileSystem.documentDirectory}${relativePath}`;
};

export const exportData = async (): Promise<void> => {
  const settings = await getSettings();
  const contracts = await getAllContracts();
  const bills = await getAllBills();
  const documents = await getAllContractDocuments();

  const exportData: ExportData = {
    version: 1,
    exported_at: toISODateTime(new Date()),
    settings,
    contracts,
    bills,
    documents,
  };

  const zip = new JSZip();
  zip.file('data.json', JSON.stringify(exportData, null, 2));

  // Add proof files and document files
  const proofsFolder = zip.folder('proofs');
  for (const bill of bills) {
    if (bill.proof_path) {
      const fullPath = `${FileSystem.documentDirectory}${bill.proof_path}`;
      const fileInfo = await FileSystem.getInfoAsync(fullPath);
      if (fileInfo.exists) {
        const fileContent = await FileSystem.readAsStringAsync(fullPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const fileName = bill.proof_path.replace('proofs/', '');
        proofsFolder!.file(fileName, fileContent, { base64: true });
      }
    }
  }

  for (const doc of documents) {
    if (doc.path) {
      const fullPath = `${FileSystem.documentDirectory}${doc.path}`;
      const fileInfo = await FileSystem.getInfoAsync(fullPath);
      if (fileInfo.exists) {
        const fileContent = await FileSystem.readAsStringAsync(fullPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const fileName = doc.path.replace('proofs/', '');
        proofsFolder!.file(fileName, fileContent, { base64: true });
      }
    }
  }

  const zipContent = await zip.generateAsync({ type: 'base64' });
  const date = new Date().toISOString().split('T')[0];
  const zipFileName = `billtracker_backup_${date}.zip`;
  const zipPath = `${FileSystem.cacheDirectory}${zipFileName}`;

  await FileSystem.writeAsStringAsync(zipPath, zipContent, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await Sharing.shareAsync(zipPath, {
    mimeType: 'application/zip',
    dialogTitle: 'Export BillTracker Data',
  });
};

export const importData = async (): Promise<boolean> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/zip',
    copyToCacheDirectory: true,
  });

  if (result.canceled) return false;

  const fileUri = result.assets[0].uri;

  try {
    const zipContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const zip = await JSZip.loadAsync(zipContent, { base64: true });
    const dataFile = zip.file('data.json');
    if (!dataFile) throw new Error('Invalid backup: missing data.json');

    const jsonStr = await dataFile.async('string');
    const data: ExportData = JSON.parse(jsonStr);

    // Validate structure
    if (!data.version || !data.contracts || !data.bills || !data.settings) {
      throw new Error('Invalid backup format');
    }

    // Clear existing data
    await clearAllData();

    // Clear existing proofs
    const proofsInfo = await FileSystem.getInfoAsync(PROOFS_DIR);
    if (proofsInfo.exists) {
      await FileSystem.deleteAsync(PROOFS_DIR, { idempotent: true });
    }
    await ensureProofsDir();

    // Restore settings
    await updateSettings({
      default_currency: data.settings.default_currency,
      language: data.settings.language,
      theme_mode: data.settings.theme_mode,
      reminders_enabled: data.settings.reminders_enabled,
      remind_before_days: data.settings.remind_before_days,
      remind_on_due_date: data.settings.remind_on_due_date,
      remind_when_overdue: data.settings.remind_when_overdue,
      overdue_reminder_interval_days: data.settings.overdue_reminder_interval_days,
      onboarding_completed: 1,
    });

    // Insert contracts, bills, and documents
    await bulkInsertContracts(data.contracts);
    await bulkInsertBills(data.bills);
    if (data.documents) {
      await bulkInsertContractDocuments(data.documents);
    }

    // Restore proof files
    const proofsFolder = zip.folder('proofs');
    if (proofsFolder) {
      const proofFiles = Object.keys(zip.files).filter((f) => f.startsWith('proofs/') && !f.endsWith('/'));
      for (const filePath of proofFiles) {
        const file = zip.file(filePath);
        if (file) {
          const content = await file.async('base64');
          const destPath = `${FileSystem.documentDirectory}${filePath}`;
          await FileSystem.writeAsStringAsync(destPath, content, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      }
    }

    // Generate any missing bills
    await generateAllBills();

    return true;
  } catch {
    return false;
  }
};
