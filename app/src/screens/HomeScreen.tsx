import React, { useState, useCallback } from 'react';
import { StyleSheet, View, SectionList, RefreshControl } from 'react-native';
import { Text, FAB, useTheme, Surface } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, parseISO } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { BillListItem } from '../components/BillListItem';
import { EmptyState } from '../components/EmptyState';
import { getUpcomingBills, getMonthlyDueAmount, getPendingBillCount, getOverdueBillCount, getSettings } from '../database/db';
import { generateAllBills } from '../services/billGeneration';
import { formatCurrency, isOverdue } from '../utils/date';
import { statusColors } from '../theme';
import type { BillWithContract } from '../types';

interface BillSection {
  title: string;
  data: BillWithContract[];
}

const groupBillsByMonth = (bills: BillWithContract[], lang: string): BillSection[] => {
  const locale = lang === 'de' ? de : enUS;
  const sections = new Map<string, BillWithContract[]>();
  const overdueBills: BillWithContract[] = [];

  for (const bill of bills) {
    if (bill.status === 'pending' && isOverdue(bill.due_date)) {
      overdueBills.push(bill);
    } else {
      const monthKey = format(parseISO(bill.due_date), 'yyyy-MM');
      const list = sections.get(monthKey) || [];
      list.push(bill);
      sections.set(monthKey, list);
    }
  }

  const result: BillSection[] = [];

  if (overdueBills.length > 0) {
    result.push({
      title: lang === 'de' ? 'Überfällig' : 'Overdue',
      data: overdueBills,
    });
  }

  const sortedKeys = [...sections.keys()].sort();
  for (const key of sortedKeys) {
    const date = parseISO(`${key}-01`);
    const title = format(date, 'MMMM yyyy', { locale });
    result.push({ title, data: sections.get(key)! });
  }

  return result;
};

export const HomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [sections, setSections] = useState<BillSection[]>([]);
  const [monthlyDue, setMonthlyDue] = useState<{ total: number; currency: string }[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await generateAllBills();
      const settings = await getSettings();
      const [billsData, monthlyData, pending, overdue] = await Promise.all([
        getUpcomingBills(settings.bills_lookahead_months),
        getMonthlyDueAmount(),
        getPendingBillCount(),
        getOverdueBillCount(),
      ]);
      setSections(groupBillsByMonth(billsData, settings.language));
      setMonthlyDue(monthlyData);
      setPendingCount(pending);
      setOverdueCount(overdue);
    } catch (error) {
      console.error('Error loading home data:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleBillPress = (bill: BillWithContract) => {
    navigation.navigate('BillDetail', { billId: bill.id });
  };

  const renderSummaryCard = () => (
    <Surface style={[styles.summaryCard, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('home.totalDue')}
          </Text>
          <Text variant="titleLarge" style={{ color: theme.colors.primary }}>
            {monthlyDue.length > 0
              ? monthlyDue.map((d) => formatCurrency(d.total, d.currency)).join(' + ')
              : formatCurrency(0, 'CHF')}
          </Text>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('home.pendingBills')}
          </Text>
          <Text variant="headlineSmall" style={{ color: statusColors.dueSoon }}>
            {pendingCount}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('home.overdueBills')}
          </Text>
          <Text variant="headlineSmall" style={{ color: overdueCount > 0 ? statusColors.overdue : statusColors.paid }}>
            {overdueCount}
          </Text>
        </View>
      </View>
    </Surface>
  );

  const hasBills = sections.length > 0;

  if (!hasBills && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {renderSummaryCard()}
        <EmptyState
          icon="receipt"
          title={t('home.noBills')}
          description={t('home.noBillsDesc')}
          actionLabel={t('addBill.title')}
          onAction={() => navigation.navigate('AddBill')}
        />
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={() => navigation.navigate('AddBill')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderSummaryCard}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.colors.elevation.level1 }]}>
            <Text
              variant="titleSmall"
              style={{
                color: section.title === 'Overdue' || section.title === 'Überfällig'
                  ? statusColors.overdue
                  : theme.colors.onSurfaceVariant,
                fontWeight: '600',
              }}
            >
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <BillListItem bill={item} onPress={handleBillPress} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate('AddBill')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    paddingBottom: 88,
  },
  summaryCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
