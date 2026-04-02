import {
  format,
  differenceInDays,
  addMonths,
  setDate,
  lastDayOfMonth,
  isAfter,
  isBefore,
  isEqual,
  parseISO,
  startOfDay,
} from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import type { BillingCycle } from '../types';

export const getLocale = (lang: string) => (lang === 'de' ? de : enUS);

export const formatDate = (dateStr: string, lang: string = 'en'): string => {
  const date = parseISO(dateStr);
  if (lang === 'de') {
    return format(date, 'dd.MM.yyyy', { locale: de });
  }
  return format(date, 'MM/dd/yyyy', { locale: enUS });
};

export const formatDateLong = (dateStr: string, lang: string = 'en'): string => {
  const date = parseISO(dateStr);
  if (lang === 'de') {
    return format(date, 'd. MMMM yyyy', { locale: de });
  }
  return format(date, 'MMMM d, yyyy', { locale: enUS });
};

export const toISODate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const toISODateTime = (date: Date): string => {
  return date.toISOString();
};

export const getDueDateLabel = (
  dueDateStr: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): string => {
  const today = startOfDay(new Date());
  const dueDate = startOfDay(parseISO(dueDateStr));
  const diff = differenceInDays(dueDate, today);

  if (diff < 0) {
    return t('home.overdueByDays', { days: Math.abs(diff) });
  }
  if (diff === 0) {
    return t('home.dueToday');
  }
  if (diff === 1) {
    return t('home.dueTomorrow');
  }
  return t('home.dueInDays', { days: diff });
};

export const isOverdue = (dueDateStr: string): boolean => {
  const today = startOfDay(new Date());
  const dueDate = startOfDay(parseISO(dueDateStr));
  return isBefore(dueDate, today);
};

export const isDueSoon = (dueDateStr: string, withinDays: number = 7): boolean => {
  const today = startOfDay(new Date());
  const dueDate = startOfDay(parseISO(dueDateStr));
  const diff = differenceInDays(dueDate, today);
  return diff >= 0 && diff <= withinDays;
};

const getCycleMonths = (cycle: BillingCycle): number => {
  switch (cycle) {
    case 'monthly': return 1;
    case 'quarterly': return 3;
    case 'semi-annual': return 6;
    case 'annual': return 12;
  }
};

export const adjustDayToMonth = (date: Date, day: number): Date => {
  const lastDay = lastDayOfMonth(date).getDate();
  const adjustedDay = Math.min(day, lastDay);
  return setDate(date, adjustedDay);
};

export const generateBillingDates = (
  startDateStr: string,
  endDateStr: string | null,
  billingCycle: BillingCycle,
  billingDay: number,
  lookaheadMonths: number = 12
): string[] => {
  const startDate = parseISO(startDateStr);
  const endDate = endDateStr ? parseISO(endDateStr) : null;
  const today = startOfDay(new Date());
  const futureLimit = addMonths(today, lookaheadMonths);
  const cutoffDate = endDate && isBefore(endDate, futureLimit) ? endDate : futureLimit;
  const cycleMonths = getCycleMonths(billingCycle);

  const dates: string[] = [];
  let current = adjustDayToMonth(startDate, billingDay);

  // If the adjusted date is before start date, move to next cycle
  if (isBefore(current, startDate)) {
    current = adjustDayToMonth(addMonths(startDate, cycleMonths), billingDay);
  }

  while (isBefore(current, cutoffDate) || isEqual(current, cutoffDate)) {
    dates.push(toISODate(current));
    current = adjustDayToMonth(addMonths(current, cycleMonths), billingDay);
  }

  return dates;
};

export const formatCurrency = (amount: number, currency: string): string => {
  return `${currency} ${amount.toFixed(2)}`;
};
