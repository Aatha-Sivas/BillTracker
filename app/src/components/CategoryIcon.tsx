import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { CATEGORIES, type Category } from '../types';

interface CategoryIconProps {
  category: Category;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 24 }) => {
  const cat = CATEGORIES.find((c) => c.key === category) ?? CATEGORIES[CATEGORIES.length - 1];

  return (
    <View style={[styles.container, { backgroundColor: cat.color + '20', width: size + 16, height: size + 16, borderRadius: (size + 16) / 2 }]}>
      <Icon source={cat.icon} size={size} color={cat.color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
