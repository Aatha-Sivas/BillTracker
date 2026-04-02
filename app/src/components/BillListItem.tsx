import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from './CategoryIcon';
import { StatusBadge } from './StatusBadge';
import { formatCurrency, getDueDateLabel, isOverdue, isDueSoon } from '../utils/date';
import { statusColors } from '../theme';
import type { BillWithContract } from '../types';

interface BillListItemProps {
  bill: BillWithContract;
  onPress: (bill: BillWithContract) => void;
}

export const BillListItem: React.FC<BillListItemProps> = ({ bill, onPress }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const getStatusColor = () => {
    if (bill.status === 'paid') return statusColors.paid;
    if (isOverdue(bill.due_date)) return statusColors.overdue;
    if (isDueSoon(bill.due_date, 3)) return statusColors.dueSoon;
    return statusColors.pending;
  };

  return (
    <List.Item
      title={bill.provider_name}
      description={() => (
        <View style={styles.description}>
          <Text variant="bodySmall" style={{ color: getStatusColor() }}>
            {bill.status === 'paid' ? t('home.paid') : getDueDateLabel(bill.due_date, t)}
          </Text>
        </View>
      )}
      left={() => (
        <View style={styles.leftContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <CategoryIcon category={bill.category} size={20} />
        </View>
      )}
      right={() => (
        <View style={styles.rightContainer}>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
            {formatCurrency(bill.amount, bill.currency)}
          </Text>
          <StatusBadge status={bill.status} dueDate={bill.due_date} />
        </View>
      )}
      onPress={() => onPress(bill)}
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
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
});
