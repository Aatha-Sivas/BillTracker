import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { statusColors } from '../theme';
import { isOverdue } from '../utils/date';
import type { BillStatus } from '../types';

interface StatusBadgeProps {
  status: BillStatus;
  dueDate: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, dueDate }) => {
  const { t } = useTranslation();

  if (status === 'paid') {
    return (
      <Chip
        style={[styles.chip, { backgroundColor: statusColors.paid + '20' }]}
        textStyle={[styles.text, { color: statusColors.paid }]}
        compact
      >
        {t('home.paid')}
      </Chip>
    );
  }

  if (isOverdue(dueDate)) {
    return (
      <Chip
        style={[styles.chip, { backgroundColor: statusColors.overdue + '20' }]}
        textStyle={[styles.text, { color: statusColors.overdue }]}
        compact
      >
        {t('home.overdue')}
      </Chip>
    );
  }

  return (
    <Chip
      style={[styles.chip, { backgroundColor: statusColors.pending + '20' }]}
      textStyle={[styles.text, { color: statusColors.pending }]}
      compact
    >
      {t('home.pending')}
    </Chip>
  );
};

const styles = StyleSheet.create({
  chip: {
    height: 28,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
