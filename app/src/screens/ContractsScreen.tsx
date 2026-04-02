import React, { useState, useCallback } from 'react';
import { StyleSheet, View, SectionList, RefreshControl } from 'react-native';
import { List, FAB, useTheme, Divider } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ContractCard } from '../components/ContractCard';
import { CategoryIcon } from '../components/CategoryIcon';
import { EmptyState } from '../components/EmptyState';
import { getContractsWithBillSummary, getSettings } from '../database/db';
import { CATEGORIES, type Category, type ContractWithBillSummary } from '../types';

interface Section {
  title: string;
  category: Category;
  data: ContractWithBillSummary[];
}

export const ContractsScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [sections, setSections] = useState<Section[]>([]);
  const [language, setLanguage] = useState('en');
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const [contracts, settings] = await Promise.all([
        getContractsWithBillSummary(),
        getSettings(),
      ]);
      setLanguage(settings.language);

      // Group by category
      const grouped = new Map<Category, ContractWithBillSummary[]>();
      for (const contract of contracts) {
        const list = grouped.get(contract.category) || [];
        list.push(contract);
        grouped.set(contract.category, list);
      }

      const sectionsList: Section[] = [];
      for (const cat of CATEGORIES) {
        const items = grouped.get(cat.key);
        if (items && items.length > 0) {
          sectionsList.push({
            title: t(`categories.${cat.key}`),
            category: cat.key,
            data: items,
          });
        }
      }

      setSections(sectionsList);
    } catch (error) {
      console.error('Error loading contracts:', error);
    }
  }, [t]);

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

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleContractPress = (contract: ContractWithBillSummary) => {
    navigation.navigate('ContractDetail', { contractId: contract.id });
  };

  if (sections.length === 0 && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          icon="file-document-outline"
          title={t('contracts.noContracts')}
          description={t('contracts.noContractsDesc')}
          actionLabel={t('contracts.addContract')}
          onAction={() => navigation.navigate('AddContract')}
        />
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color={theme.colors.onPrimary}
          onPress={() => navigation.navigate('AddContract')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <SectionList
        sections={sections.map((section) => ({
          ...section,
          data: collapsedCategories.has(section.category) ? [] : section.data,
        }))}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <List.Item
            title={section.title}
            left={() => <CategoryIcon category={(section as Section).category} size={18} />}
            right={(props) => (
              <List.Icon
                {...props}
                icon={collapsedCategories.has((section as Section).category) ? 'chevron-down' : 'chevron-up'}
              />
            )}
            onPress={() => toggleCategory((section as Section).category)}
            style={[styles.sectionHeader, { backgroundColor: theme.colors.elevation.level1 }]}
            titleStyle={{ fontWeight: '600' }}
          />
        )}
        renderItem={({ item }) => (
          <ContractCard contract={item} onPress={handleContractPress} language={language} />
        )}
        SectionSeparatorComponent={() => <Divider />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => navigation.navigate('AddContract')}
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
  sectionHeader: {
    paddingVertical: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
