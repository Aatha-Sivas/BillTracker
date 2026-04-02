import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from './CategoryIcon';
import { formatCurrency, formatDate } from '../utils/date';
import { statusColors } from '../theme';
import type { ContractWithBillSummary, BillingCycle } from '../types';

interface ContractCardProps {
  contract: ContractWithBillSummary;
  onPress: (contract: ContractWithBillSummary) => void;
  language: string;
}

const getCycleLabel = (cycle: BillingCycle, t: (k: string) => string): string => {
  switch (cycle) {
    case 'monthly': return t('contracts.perMonth');
    case 'quarterly': return t('contracts.perQuarter');
    case 'semi-annual': return t('contracts.perSemiAnnual');
    case 'annual': return t('contracts.perYear');
  }
};

export const ContractCard: React.FC<ContractCardProps> = ({ contract, onPress, language }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const statusText = contract.overdue_count > 0
    ? t('contracts.overdueCount', { count: contract.overdue_count })
    : contract.all_paid
      ? t('contracts.allPaid')
      : '';

  const statusColor = contract.overdue_count > 0 ? statusColors.overdue : statusColors.paid;

  return (
    <List.Item
      title={contract.provider_name}
      description={() => (
        <View style={styles.description}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {formatCurrency(contract.amount, contract.currency)} {getCycleLabel(contract.billing_cycle, t)}
          </Text>
          {contract.next_due_date && (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {t('contracts.nextDue')}: {formatDate(contract.next_due_date, language)}
            </Text>
          )}
          {statusText !== '' && (
            <Text variant="bodySmall" style={{ color: statusColor, fontWeight: '600' }}>
              {statusText}
            </Text>
          )}
        </View>
      )}
      left={() => (
        <View style={styles.leftContainer}>
          <CategoryIcon category={contract.category} size={20} />
        </View>
      )}
      right={() => (
        <View style={styles.rightContainer}>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
            {formatCurrency(contract.amount, contract.currency)}
          </Text>
        </View>
      )}
      onPress={() => onPress(contract)}
      style={styles.item}
    />
  );
};

const styles = StyleSheet.create({
  item: {
    paddingVertical: 4,
  },
  description: {
    marginTop: 2,
    gap: 1,
  },
  leftContainer: {
    justifyContent: 'center',
    marginLeft: 8,
  },
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
