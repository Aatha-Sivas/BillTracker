import * as SQLite from 'expo-sqlite';
import { initializeDatabase } from './schema';
import type { SQLiteBindValue } from 'expo-sqlite';
import type {
  Settings,
  Contract,
  Bill,
  BillWithContract,
  ContractWithBillSummary,
  ThemeMode,
  ContractDocument,
  Category,
  Provider,
  ProviderSummary,
} from '../types';
import * as Crypto from 'expo-crypto';
import { toISODateTime, toISODate } from '../utils/date';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('billtracker.db');
    await initializeDatabase(db);
  }
  return db;
};

// Settings
export const getSettings = async (): Promise<Settings> => {
  const database = await getDatabase();
  const result = await database.getFirstAsync<Settings>('SELECT * FROM settings WHERE id = 1');
  return result!;
};

export const updateSettings = async (updates: Partial<Settings>): Promise<void> => {
  const database = await getDatabase();
  const fields: string[] = [];
  const values: SQLiteBindValue[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'id') {
      fields.push(`${key} = ?`);
      values.push(value as SQLiteBindValue);
    }
  }

  if (fields.length > 0) {
    await database.runAsync(
      `UPDATE settings SET ${fields.join(', ')} WHERE id = 1`,
      values
    );
  }
};

// Contracts
export const getAllContracts = async (): Promise<Contract[]> => {
  const database = await getDatabase();
  return database.getAllAsync<Contract>(
    'SELECT * FROM contracts ORDER BY provider_name ASC'
  );
};

export const getContractById = async (id: string): Promise<Contract | null> => {
  const database = await getDatabase();
  return database.getFirstAsync<Contract>(
    'SELECT * FROM contracts WHERE id = ?',
    [id]
  );
};

export const getContractsWithBillSummary = async (): Promise<ContractWithBillSummary[]> => {
  const database = await getDatabase();
  const today = toISODate(new Date());

  return database.getAllAsync<ContractWithBillSummary>(`
    SELECT c.*,
      (SELECT MIN(b.due_date) FROM bills b WHERE b.contract_id = c.id AND b.status = 'pending' AND b.due_date >= ?) as next_due_date,
      (SELECT COUNT(*) FROM bills b WHERE b.contract_id = c.id AND b.status = 'pending' AND b.due_date < ?) as overdue_count,
      (SELECT COUNT(*) FROM bills b WHERE b.contract_id = c.id AND b.status = 'pending') as pending_count,
      CASE WHEN (SELECT COUNT(*) FROM bills b WHERE b.contract_id = c.id AND b.status = 'pending') = 0 THEN 1 ELSE 0 END as all_paid
    FROM contracts c
    ORDER BY c.provider_name ASC
  `, [today, today]);
};

export const createContract = async (
  contract: Omit<Contract, 'id' | 'created_at' | 'updated_at'>
): Promise<string> => {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = toISODateTime(new Date());

  await database.runAsync(
    `INSERT INTO contracts (id, provider_name, category, amount, currency, billing_cycle, billing_day, start_date, end_date, cancellation_notice_days, payment_method, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      contract.provider_name,
      contract.category,
      contract.amount,
      contract.currency,
      contract.billing_cycle,
      contract.billing_day,
      contract.start_date,
      contract.end_date,
      contract.cancellation_notice_days,
      contract.payment_method,
      contract.notes,
      now,
      now,
    ]
  );

  return id;
};

export const updateContract = async (
  id: string,
  contract: Partial<Omit<Contract, 'id' | 'created_at' | 'updated_at'>>
): Promise<void> => {
  const database = await getDatabase();
  const now = toISODateTime(new Date());
  const fields: string[] = ['updated_at = ?'];
  const values: SQLiteBindValue[] = [now];

  for (const [key, value] of Object.entries(contract)) {
    fields.push(`${key} = ?`);
    values.push(value as SQLiteBindValue);
  }

  values.push(id);
  await database.runAsync(
    `UPDATE contracts SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
};

export const deleteContract = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM contracts WHERE id = ?', [id]);
};

// Bills
export const getBillsForContract = async (contractId: string): Promise<Bill[]> => {
  const database = await getDatabase();
  // Also include standalone bills whose provider matches this contract's provider,
  // so one-time bills don't vanish when a contract is created for the same provider.
  return database.getAllAsync<Bill>(`
    SELECT * FROM bills
    WHERE contract_id = ?
       OR (contract_id IS NULL AND provider_name = (SELECT provider_name FROM contracts WHERE id = ?))
    ORDER BY due_date ASC
  `, [contractId, contractId]);
};

export const getUpcomingBills = async (lookaheadMonths: number = 3): Promise<BillWithContract[]> => {
  const database = await getDatabase();
  const cutoff = toISODate(new Date(new Date().getFullYear(), new Date().getMonth() + lookaheadMonths + 1, 0));
  return database.getAllAsync<BillWithContract>(`
    SELECT b.*,
      COALESCE(c.provider_name, b.provider_name) as provider_name,
      COALESCE(c.category, b.category) as category,
      c.amount as contract_amount
    FROM bills b
    LEFT JOIN contracts c ON b.contract_id = c.id
    WHERE (b.status = 'pending' AND b.due_date <= ?) OR (b.status = 'pending' AND b.due_date < date('now')) OR (b.status = 'paid' AND b.paid_date >= date('now', '-7 days'))
    ORDER BY
      CASE WHEN b.status = 'pending' AND b.due_date < date('now') THEN 0
           WHEN b.status = 'pending' THEN 1
           ELSE 2 END,
      b.due_date ASC
  `, [cutoff]);
};

export const getBillById = async (id: string): Promise<BillWithContract | null> => {
  const database = await getDatabase();
  return database.getFirstAsync<BillWithContract>(`
    SELECT b.*,
      COALESCE(c.provider_name, b.provider_name) as provider_name,
      COALESCE(c.category, b.category) as category,
      c.amount as contract_amount
    FROM bills b
    LEFT JOIN contracts c ON b.contract_id = c.id
    WHERE b.id = ?
  `, [id]);
};

export const createBill = async (
  bill: Omit<Bill, 'id' | 'created_at' | 'updated_at'>
): Promise<string | null> => {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = toISODateTime(new Date());

  try {
    await database.runAsync(
      `INSERT OR IGNORE INTO bills (id, contract_id, due_date, status, paid_date, amount, currency, proof_type, proof_path, notes, provider_name, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        bill.contract_id,
        bill.due_date,
        bill.status,
        bill.paid_date,
        bill.amount,
        bill.currency,
        bill.proof_type,
        bill.proof_path,
        bill.notes,
        bill.provider_name ?? null,
        bill.category ?? null,
        now,
        now,
      ]
    );
    return id;
  } catch {
    // Duplicate bill (contract_id + due_date), ignore
    return null;
  }
};

export const markBillAsPaid = async (id: string, paidDate?: string): Promise<void> => {
  const database = await getDatabase();
  const now = toISODateTime(new Date());
  const paymentDate = paidDate ?? toISODate(new Date());

  await database.runAsync(
    `UPDATE bills SET status = 'paid', paid_date = ?, updated_at = ? WHERE id = ?`,
    [paymentDate, now, id]
  );
};

export const markBillAsUnpaid = async (id: string): Promise<void> => {
  const database = await getDatabase();
  const now = toISODateTime(new Date());

  await database.runAsync(
    `UPDATE bills SET status = 'pending', paid_date = NULL, updated_at = ? WHERE id = ?`,
    [now, id]
  );
};

export const updateBillProof = async (
  id: string,
  proofType: 'photo' | 'pdf' | null,
  proofPath: string | null
): Promise<void> => {
  const database = await getDatabase();
  const now = toISODateTime(new Date());

  await database.runAsync(
    `UPDATE bills SET proof_type = ?, proof_path = ?, updated_at = ? WHERE id = ?`,
    [proofType, proofPath, now, id]
  );
};

export const updateBillNotes = async (id: string, notes: string | null): Promise<void> => {
  const database = await getDatabase();
  const now = toISODateTime(new Date());

  await database.runAsync(
    `UPDATE bills SET notes = ?, updated_at = ? WHERE id = ?`,
    [notes, now, id]
  );
};

export const getMonthlyDueAmount = async (): Promise<{ total: number; currency: string }[]> => {
  const database = await getDatabase();
  const startOfMonth = toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const endOfMonth = toISODate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));

  return database.getAllAsync<{ total: number; currency: string }>(`
    SELECT SUM(amount) as total, currency
    FROM bills
    WHERE status = 'pending' AND due_date >= ? AND due_date <= ?
    GROUP BY currency
  `, [startOfMonth, endOfMonth]);
};

export const getPendingBillCount = async (): Promise<number> => {
  const database = await getDatabase();
  const startOfMonth = toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const endOfMonth = toISODate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
  const result = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM bills WHERE status = 'pending' AND due_date >= ? AND due_date <= ?`,
    [startOfMonth, endOfMonth]
  );
  return result?.count ?? 0;
};

export const getOverdueBillCount = async (): Promise<number> => {
  const database = await getDatabase();
  const today = toISODate(new Date());
  const result = await database.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM bills WHERE status = 'pending' AND due_date < ?`,
    [today]
  );
  return result?.count ?? 0;
};

// Contract Documents
export const getContractDocuments = async (contractId: string): Promise<ContractDocument[]> => {
  const database = await getDatabase();
  return database.getAllAsync<ContractDocument>(
    'SELECT * FROM contract_documents WHERE contract_id = ? ORDER BY created_at DESC',
    [contractId]
  );
};

export const addContractDocument = async (
  doc: Omit<ContractDocument, 'id' | 'created_at'>
): Promise<string> => {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = toISODateTime(new Date());
  await database.runAsync(
    `INSERT INTO contract_documents (id, contract_id, name, type, path, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, doc.contract_id, doc.name, doc.type, doc.path, now]
  );
  return id;
};

export const deleteContractDocument = async (id: string): Promise<void> => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM contract_documents WHERE id = ?', [id]);
};

export const getAllContractDocuments = async (): Promise<ContractDocument[]> => {
  const database = await getDatabase();
  return database.getAllAsync<ContractDocument>('SELECT * FROM contract_documents');
};

export const bulkInsertContractDocuments = async (docs: ContractDocument[]): Promise<void> => {
  const database = await getDatabase();
  for (const doc of docs) {
    await database.runAsync(
      `INSERT INTO contract_documents (id, contract_id, name, type, path, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [doc.id, doc.contract_id, doc.name, doc.type, doc.path, doc.created_at]
    );
  }
};

// Quick / standalone bills
export const createQuickBill = async (bill: {
  provider_name: string;
  category: Category;
  amount: number;
  currency: string;
  due_date: string;
  notes: string | null;
}): Promise<string> => {
  const database = await getDatabase();
  const id = Crypto.randomUUID();
  const now = toISODateTime(new Date());
  await database.runAsync(
    `INSERT INTO bills (id, contract_id, due_date, status, paid_date, amount, currency, proof_type, proof_path, notes, provider_name, category, created_at, updated_at)
     VALUES (?, NULL, ?, 'pending', NULL, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)`,
    [id, bill.due_date, bill.amount, bill.currency, bill.notes, bill.provider_name, bill.category, now, now]
  );
  return id;
};

export const createBillForContract = async (
  contractId: string,
  dueDate: string,
  amount: number,
  currency: string,
  notes: string | null,
): Promise<string | null> => {
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ id: string }>(
    'SELECT id FROM bills WHERE contract_id = ? AND due_date = ?',
    [contractId, dueDate]
  );
  if (existing) return null;
  const id = Crypto.randomUUID();
  const now = toISODateTime(new Date());
  await database.runAsync(
    `INSERT INTO bills (id, contract_id, due_date, status, paid_date, amount, currency, proof_type, proof_path, notes, provider_name, category, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', NULL, ?, ?, NULL, NULL, ?, NULL, NULL, ?, ?)`,
    [id, contractId, dueDate, amount, currency, notes, now, now]
  );
  return id;
};

export const updateBillAmount = async (id: string, amount: number): Promise<void> => {
  const database = await getDatabase();
  const now = toISODateTime(new Date());
  await database.runAsync(
    'UPDATE bills SET amount = ?, updated_at = ? WHERE id = ?',
    [amount, now, id]
  );
};

// Providers
export const getAllProviders = async (): Promise<Provider[]> => {
  const database = await getDatabase();
  return database.getAllAsync<Provider>(`
    SELECT DISTINCT provider_name as name, category FROM contracts
    UNION
    SELECT DISTINCT provider_name as name, category FROM bills WHERE contract_id IS NULL AND provider_name IS NOT NULL
    ORDER BY name ASC
  `);
};

export const getStandaloneProviders = async (): Promise<ProviderSummary[]> => {
  const database = await getDatabase();
  const today = toISODate(new Date());
  return database.getAllAsync<ProviderSummary>(`
    SELECT
      b.provider_name,
      b.category,
      COUNT(*) as bill_count,
      MIN(CASE WHEN b.status = 'pending' AND b.due_date >= ? THEN b.due_date END) as next_due_date,
      SUM(CASE WHEN b.status = 'pending' AND b.due_date < ? THEN 1 ELSE 0 END) as overdue_count,
      CASE WHEN SUM(CASE WHEN b.status = 'pending' THEN 1 ELSE 0 END) = 0 THEN 1 ELSE 0 END as all_paid
    FROM bills b
    WHERE b.contract_id IS NULL
      AND b.provider_name IS NOT NULL
      AND b.provider_name NOT IN (SELECT c.provider_name FROM contracts c)
    GROUP BY b.provider_name, b.category
    ORDER BY b.provider_name ASC
  `, [today, today]);
};

export const getBillsForProvider = async (providerName: string): Promise<Bill[]> => {
  const database = await getDatabase();
  return database.getAllAsync<Bill>(
    'SELECT * FROM bills WHERE provider_name = ? AND contract_id IS NULL ORDER BY due_date DESC',
    [providerName]
  );
};

export const updateProvider = async (
  oldName: string,
  newName: string,
  newCategory: Category,
): Promise<void> => {
  const database = await getDatabase();
  const now = toISODateTime(new Date());
  await database.runAsync(
    'UPDATE bills SET provider_name = ?, category = ?, updated_at = ? WHERE provider_name = ? AND contract_id IS NULL',
    [newName, newCategory, now, oldName]
  );
};

// Bulk operations for import/export
export const getAllBills = async (): Promise<Bill[]> => {
  const database = await getDatabase();
  return database.getAllAsync<Bill>('SELECT * FROM bills');
};

export const clearAllData = async (): Promise<void> => {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM contract_documents;
    DELETE FROM bills;
    DELETE FROM contracts;
  `);
};

export const bulkInsertContracts = async (contracts: Contract[]): Promise<void> => {
  const database = await getDatabase();
  for (const contract of contracts) {
    await database.runAsync(
      `INSERT INTO contracts (id, provider_name, category, amount, currency, billing_cycle, billing_day, start_date, end_date, cancellation_notice_days, payment_method, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contract.id,
        contract.provider_name,
        contract.category,
        contract.amount,
        contract.currency,
        contract.billing_cycle,
        contract.billing_day,
        contract.start_date,
        contract.end_date,
        contract.cancellation_notice_days,
        contract.payment_method,
        contract.notes,
        contract.created_at,
        contract.updated_at,
      ]
    );
  }
};

export const bulkInsertBills = async (bills: Bill[]): Promise<void> => {
  const database = await getDatabase();
  for (const bill of bills) {
    await database.runAsync(
      `INSERT INTO bills (id, contract_id, due_date, status, paid_date, amount, currency, proof_type, proof_path, notes, provider_name, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bill.id,
        bill.contract_id,
        bill.due_date,
        bill.status,
        bill.paid_date,
        bill.amount,
        bill.currency,
        bill.proof_type,
        bill.proof_path,
        bill.notes,
        bill.provider_name ?? null,
        bill.category ?? null,
        bill.created_at,
        bill.updated_at,
      ]
    );
  }
};
