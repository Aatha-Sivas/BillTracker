import type { SQLiteDatabase } from 'expo-sqlite';

export const initializeDatabase = async (db: SQLiteDatabase): Promise<void> => {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      default_currency TEXT NOT NULL DEFAULT 'CHF',
      language TEXT NOT NULL DEFAULT 'en',
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      theme_mode TEXT NOT NULL DEFAULT 'system',
      bills_lookahead_months INTEGER NOT NULL DEFAULT 12,
      reminders_enabled INTEGER NOT NULL DEFAULT 1,
      remind_before_days INTEGER NOT NULL DEFAULT 3,
      remind_on_due_date INTEGER NOT NULL DEFAULT 1,
      remind_when_overdue INTEGER NOT NULL DEFAULT 1,
      overdue_reminder_interval_days INTEGER NOT NULL DEFAULT 2
    );

    INSERT OR IGNORE INTO settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      provider_name TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      billing_cycle TEXT NOT NULL,
      billing_day INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      cancellation_notice_days INTEGER,
      payment_method TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_date TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      proof_type TEXT,
      proof_path TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
      UNIQUE(contract_id, due_date)
    );

    CREATE TABLE IF NOT EXISTS contract_documents (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_contract_documents_contract_id ON contract_documents(contract_id);

    CREATE INDEX IF NOT EXISTS idx_bills_contract_id ON bills(contract_id);
    CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);
    CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
  `);

  // Migration: add bills_lookahead_months if missing
  try {
    await db.runAsync(
      `ALTER TABLE settings ADD COLUMN bills_lookahead_months INTEGER NOT NULL DEFAULT 12`
    );
  } catch {
    // Column already exists, ignore
  }
};
