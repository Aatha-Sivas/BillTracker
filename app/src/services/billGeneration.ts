import { getAllContracts, createBill, getSettings } from '../database/db';
import { generateBillingDates } from '../utils/date';
import type { Contract } from '../types';

export const generateBillsForContract = async (contract: Contract, lookaheadMonths?: number): Promise<void> => {
  const months = lookaheadMonths ?? (await getSettings()).bills_lookahead_months;
  const dates = generateBillingDates(
    contract.start_date,
    contract.end_date,
    contract.billing_cycle,
    contract.billing_day,
    months
  );

  for (const dueDate of dates) {
    await createBill({
      contract_id: contract.id,
      due_date: dueDate,
      status: 'pending',
      paid_date: null,
      amount: contract.amount,
      currency: contract.currency,
      proof_type: null,
      proof_path: null,
      notes: null,
      provider_name: null,
      category: null,
    });
  }
};

export const generateAllBills = async (): Promise<void> => {
  const settings = await getSettings();
  const contracts = await getAllContracts();
  for (const contract of contracts) {
    await generateBillsForContract(contract, settings.bills_lookahead_months);
  }
};
