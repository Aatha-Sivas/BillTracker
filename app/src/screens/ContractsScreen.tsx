import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, SectionList, RefreshControl } from 'react-native';
import { List, FAB, useTheme, Divider, Searchbar, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ContractCard } from '../components/ContractCard';
import { CategoryIcon } from '../components/CategoryIcon';
import { EmptyState } from '../components/EmptyState';
import { getContractsWithBillSummary, getStandaloneProviders, getSettings } from '../database/db';
import { formatDate } from '../utils/date';
import { statusColors } from '../theme';
import { CATEGORIES, type Category, type ContractWithBillSummary, type ProviderSummary } from '../types';

interface ListSection {
  title: string;
  category: Category | 'providers';
  type: 'contract' | 'provider';
  // Using any[] to satisfy SectionList's homogeneous type constraint
  // The renderItem callback discriminates via section.type
  data: any[];
}

export const ContractsScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [contractSections, setContractSections] = useState<ListSection[]>([]);
  const [standaloneProviders, setStandaloneProviders] = useState<ProviderSummary[]>([]);
  const [language, setLanguage] = useState('en');
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [contracts, providers, settings] = await Promise.all([
        getContractsWithBillSummary(),
        getStandaloneProviders(),
        getSettings(),
      ]);
      setLanguage(settings.language);
      setStandaloneProviders(providers);

      // Group contracts by category
      const grouped = new Map<Category, ContractWithBillSummary[]>();
      for (const contract of contracts) {
        const list = grouped.get(contract.category) || [];
        list.push(contract);
        grouped.set(contract.category, list);
      }

      const sectionsList: ListSection[] = [];
      for (const cat of CATEGORIES) {
        const items = grouped.get(cat.key);
        if (items && items.length > 0) {
          sectionsList.push({
            title: t(`categories.${cat.key}`),
            category: cat.key,
            type: 'contract',
            data: items,
          });
        }
      }

      setContractSections(sectionsList);
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

  const handleProviderPress = (provider: ProviderSummary) => {
    navigation.navigate('ProviderDetail', {
      providerName: provider.provider_name,
      category: provider.category,
    });
  };

  // Filter sections by search query
  const filteredSections = useMemo((): ListSection[] => {
    const query = searchQuery.toLowerCase().trim();
    const result: ListSection[] = [];

    for (const section of contractSections) {
      const filtered = query
        ? section.data.filter((c) => c.provider_name.toLowerCase().includes(query))
        : section.data;
      if (filtered.length > 0) {
        result.push({ ...section, data: filtered });
      }
    }

    // Add providers section
    const filteredProviders = query
      ? standaloneProviders.filter((p) => p.provider_name.toLowerCase().includes(query))
      : standaloneProviders;
    if (filteredProviders.length > 0) {
      result.push({
        title: t('providers.title'),
        category: 'providers',
        type: 'provider',
        data: filteredProviders,
      });
    }

    return result;
  }, [contractSections, standaloneProviders, searchQuery, t]);

  const hasContent = contractSections.length > 0 || standaloneProviders.length > 0;

  if (!hasContent && !refreshing) {
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
      <Searchbar
        placeholder={t('common.search')}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchBar}
        mode="bar"
      />
      <SectionList
        sections={filteredSections.map((section) => {
          if (section.type === 'provider') return section;
          return {
            ...section,
            data: collapsedCategories.has(section.category) ? [] : section.data,
          };
        })}
        keyExtractor={(item, index) => ('id' in item ? item.id : `provider-${index}`)}
        renderSectionHeader={({ section }) => {
          if (section.type === 'provider') {
            return (
              <List.Item
                title={section.title}
                left={() => (
                  <View style={styles.providerHeaderIcon}>
                    <CategoryIcon category="other" size={18} />
                  </View>
                )}
                style={[styles.sectionHeader, { backgroundColor: theme.colors.elevation.level1 }]}
                titleStyle={{ fontWeight: '600' }}
              />
            );
          }
          const cat = section.category as Category;
          return (
            <List.Item
              title={section.title}
              left={() => <CategoryIcon category={cat} size={18} />}
              right={(props) => (
                <List.Icon
                  {...props}
                  icon={collapsedCategories.has(cat) ? 'chevron-down' : 'chevron-up'}
                />
              )}
              onPress={() => toggleCategory(cat)}
              style={[styles.sectionHeader, { backgroundColor: theme.colors.elevation.level1 }]}
              titleStyle={{ fontWeight: '600' }}
            />
          );
        }}
        renderItem={({ item, section }) => {
          if (section.type === 'provider') {
            const provider = item as ProviderSummary;
            const statusText = provider.overdue_count > 0
              ? t('contracts.overdueCount', { count: provider.overdue_count })
              : provider.all_paid
                ? t('contracts.allPaid')
                : '';
            const statusColor = provider.overdue_count > 0 ? statusColors.overdue : statusColors.paid;
            return (
              <List.Item
                title={provider.provider_name}
                description={() => (
                  <View style={styles.providerDesc}>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t('providers.billCount', { count: provider.bill_count })}
                    </Text>
                    {provider.next_due_date && (
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {t('contracts.nextDue')}: {formatDate(provider.next_due_date, language)}
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
                  <View style={styles.providerIcon}>
                    <CategoryIcon category={provider.category} size={20} />
                  </View>
                )}
                onPress={() => handleProviderPress(provider)}
                style={styles.providerItem}
              />
            );
          }
          return (
            <ContractCard
              contract={item as ContractWithBillSummary}
              onPress={handleContractPress}
              language={language}
            />
          );
        }}
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
  searchBar: {
    margin: 12,
    marginBottom: 4,
  },
  list: {
    paddingBottom: 88,
  },
  sectionHeader: {
    paddingVertical: 4,
  },
  providerHeaderIcon: {
    justifyContent: 'center',
    marginLeft: 8,
  },
  providerItem: {
    paddingVertical: 4,
  },
  providerDesc: {
    marginTop: 2,
    gap: 1,
  },
  providerIcon: {
    justifyContent: 'center',
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
});
