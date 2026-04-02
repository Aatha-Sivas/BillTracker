export type Category =
  | 'utilities'
  | 'insurance'
  | 'subscriptions'
  | 'rent'
  | 'telecom'
  | 'internet'
  | 'health'
  | 'transportation'
  | 'other';

export type BillingCycle = 'monthly' | 'quarterly' | 'semi-annual' | 'annual';

export type PaymentMethod =
  | 'direct_debit'
  | 'bank_transfer'
  | 'credit_card'
  | 'cash'
  | 'other'
  | null;

export type BillStatus = 'pending' | 'paid';

export type ProofType = 'photo' | 'pdf' | null;

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  id: number;
  default_currency: string;
  language: string;
  onboarding_completed: number;
  theme_mode: ThemeMode;
  bills_lookahead_months: number;
  reminders_enabled: number;
  remind_before_days: number;
  remind_on_due_date: number;
  remind_when_overdue: number;
  overdue_reminder_interval_days: number;
}

export interface Contract {
  id: string;
  provider_name: string;
  category: Category;
  amount: number;
  currency: string;
  billing_cycle: BillingCycle;
  billing_day: number;
  start_date: string;
  end_date: string | null;
  cancellation_notice_days: number | null;
  payment_method: PaymentMethod;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  contract_id: string;
  due_date: string;
  status: BillStatus;
  paid_date: string | null;
  amount: number;
  currency: string;
  proof_type: ProofType;
  proof_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractDocument {
  id: string;
  contract_id: string;
  name: string;
  type: 'photo' | 'pdf';
  path: string;
  created_at: string;
}

export interface BillWithContract extends Bill {
  provider_name: string;
  category: Category;
}

export interface ContractWithBillSummary extends Contract {
  next_due_date: string | null;
  overdue_count: number;
  pending_count: number;
  all_paid: boolean;
}

export const CATEGORIES: { key: Category; icon: string; color: string }[] = [
  { key: 'utilities', icon: 'flash', color: '#F59E0B' },
  { key: 'insurance', icon: 'shield-check', color: '#3B82F6' },
  { key: 'subscriptions', icon: 'refresh', color: '#8B5CF6' },
  { key: 'rent', icon: 'home', color: '#EF4444' },
  { key: 'telecom', icon: 'phone', color: '#10B981' },
  { key: 'internet', icon: 'wifi', color: '#06B6D4' },
  { key: 'health', icon: 'heart-pulse', color: '#EC4899' },
  { key: 'transportation', icon: 'car', color: '#F97316' },
  { key: 'other', icon: 'dots-horizontal', color: '#6B7280' },
];

export const CURRENCIES = [
  'CHF', 'EUR', 'USD', 'GBP', 'JPY', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'HRK', 'TRY', 'BRL', 'INR', 'CNY',
];

export const BILLING_CYCLES: { key: BillingCycle; months: number }[] = [
  { key: 'monthly', months: 1 },
  { key: 'quarterly', months: 3 },
  { key: 'semi-annual', months: 6 },
  { key: 'annual', months: 12 },
];

export interface ExportData {
  version: number;
  exported_at: string;
  settings: Settings;
  contracts: Contract[];
  bills: Bill[];
  documents: ContractDocument[];
}
