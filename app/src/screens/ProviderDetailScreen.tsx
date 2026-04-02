import React, { useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import {
  Appbar,
  Text,
  useTheme,
  Surface,
  List,
  Portal,
  Dialog,
  Button,
  TextInput,
  Menu,
  HelperText,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getBillsForProvider, getSettings, updateProvider } from '../database/db';
import { CategoryIcon } from '../components/CategoryIcon';
import { StatusBadge } from '../components/StatusBadge';
import { DropdownField } from '../components/DropdownField';
import { formatCurrency, formatDate, isOverdue } from '../utils/date';
import { statusColors } from '../theme';
import { CATEGORIES, type Bill, type Category } from '../types';

type RouteParams = {
  ProviderDetail: { providerName: string; category: Category };
};

export const ProviderDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<RouteParams, 'ProviderDetail'>>();
  const { providerName: initialName, category: initialCategory } = route.params;

  const [currentName, setCurrentName] = useState(initialName);
  const [currentCategory, setCurrentCategory] = useState<Category>(initialCategory);
  const [bills, setBills] = useState<Bill[]>([]);
  const [language, setLanguage] = useState('en');

  // Edit dialog state
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<Category>('other');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    const [b, s] = await Promise.all([
      getBillsForProvider(currentName),
      getSettings(),
    ]);
    setBills(b);
    setLanguage(s.language);
  }, [currentName]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openEditDialog = () => {
    setEditName(currentName);
    setEditCategory(currentCategory);
    setEditErrors({});
    setEditDialogVisible(true);
  };

  const handleSaveEdit = async () => {
    const newErrors: Record<string, string> = {};
    if (!editName.trim()) newErrors.name = t('common.required');
    setEditErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setEditDialogVisible(false);
    const oldName = currentName;
    const newName = editName.trim();
    const newCategory = editCategory;

    await updateProvider(oldName, newName, newCategory);
    setCurrentName(newName);
    setCurrentCategory(newCategory);
    navigation.setParams({ providerName: newName, category: newCategory });
    loadData();
  };

  const getCategoryIcon = (cat: Category): string => {
    return CATEGORIES.find((c) => c.key === cat)?.icon || 'dots-horizontal';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={currentName} />
        <Appbar.Action icon="pencil" onPress={openEditDialog} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Provider Info Card */}
        <Surface style={[styles.card, { backgroundColor: theme.colors.elevation.level2 }]} elevation={1}>
          <View style={styles.headerRow}>
            <CategoryIcon category={currentCategory} size={28} />
            <View style={styles.headerText}>
              <Text variant="headlineSmall">{currentName}</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {t(`categories.${currentCategory}`)}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Bills List */}
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">{t('bills.title')} ({bills.length})</Text>
        </View>

        {bills.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 16 }}>
            {t('providers.noBills')}
          </Text>
        ) : (
          bills.map((bill) => (
            <List.Item
              key={bill.id}
              title={formatDate(bill.due_date, language)}
              description={formatCurrency(bill.amount, bill.currency)}
              left={() => (
                <View style={styles.billStatusDot}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          bill.status === 'paid'
                            ? statusColors.paid
                            : isOverdue(bill.due_date)
                              ? statusColors.overdue
                              : statusColors.pending,
                      },
                    ]}
                  />
                </View>
              )}
              right={() => <StatusBadge status={bill.status} dueDate={bill.due_date} />}
              onPress={() => navigation.navigate('BillDetail', { billId: bill.id })}
            />
          ))
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
          <Dialog.Title>{t('providers.editProvider')}</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <TextInput
              label={t('providers.providerName')}
              value={editName}
              onChangeText={setEditName}
              mode="outlined"
              error={!!editErrors.name}
              autoFocus
            />
            {editErrors.name && <HelperText type="error">{editErrors.name}</HelperText>}

            <DropdownField
              label={t('addBill.selectCategory')}
              value={t(`categories.${editCategory}`)}
              icon={getCategoryIcon(editCategory)}
            >
              {(close) =>
                CATEGORIES.map((cat) => (
                  <Menu.Item
                    key={cat.key}
                    leadingIcon={cat.icon}
                    title={t(`categories.${cat.key}`)}
                    onPress={() => { setEditCategory(cat.key); close(); }}
                  />
                ))
              }
            </DropdownField>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogVisible(false)}>{t('common.cancel')}</Button>
            <Button onPress={handleSaveEdit}>{t('common.save')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
  },
  dialogContent: {
    gap: 8,
  },
  billStatusDot: {
    justifyContent: 'center',
    marginLeft: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
