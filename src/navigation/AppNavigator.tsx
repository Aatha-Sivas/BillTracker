import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { HomeScreen } from '../screens/HomeScreen';
import { ContractsScreen } from '../screens/ContractsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ContractDetailScreen } from '../screens/ContractDetailScreen';
import { BillDetailScreen } from '../screens/BillDetailScreen';
import { AddEditContractScreen } from '../screens/AddEditContractScreen';
import type { ThemeMode } from '../types';

export type RootStackParamList = {
  MainTabs: undefined;
  ContractDetail: { contractId: string };
  BillDetail: { billId: string };
  AddContract: undefined;
  EditContract: { contractId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

interface TabNavigatorProps {
  onThemeChange?: (mode: ThemeMode) => void;
  onLanguageChange?: (lang: string) => void;
}

const TabNavigator: React.FC<TabNavigatorProps> = ({ onThemeChange, onLanguageChange }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: theme.colors.elevation.level2,
          borderTopColor: theme.colors.outlineVariant,
        },
        headerStyle: {
          backgroundColor: theme.colors.elevation.level2,
        },
        headerTintColor: theme.colors.onSurface,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: t('home.title'),
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Contracts"
        component={ContractsScreen}
        options={{
          title: t('contracts.title'),
          tabBarLabel: t('tabs.contracts'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="file-document" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        options={{
          title: t('settings.title'),
          tabBarLabel: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      >
        {() => <SettingsScreen onThemeChange={onThemeChange} onLanguageChange={onLanguageChange} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

interface AppNavigatorProps {
  onThemeChange?: (mode: ThemeMode) => void;
  onLanguageChange?: (lang: string) => void;
}

export const AppNavigator: React.FC<AppNavigatorProps> = ({ onThemeChange, onLanguageChange }) => {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs">
        {() => <TabNavigator onThemeChange={onThemeChange} onLanguageChange={onLanguageChange} />}
      </Stack.Screen>
      <Stack.Screen name="ContractDetail" component={ContractDetailScreen} />
      <Stack.Screen name="BillDetail" component={BillDetailScreen} />
      <Stack.Screen name="AddContract" component={AddEditContractScreen} />
      <Stack.Screen
        name="EditContract"
        component={AddEditContractScreen}
        initialParams={{}}
      />
    </Stack.Navigator>
  );
};
