import React, { useState, useCallback } from 'react';
import { View, Pressable, ScrollView, type LayoutChangeEvent } from 'react-native';
import { TextInput, Menu } from 'react-native-paper';

interface DropdownFieldProps {
  label: string;
  value: string;
  icon?: string;
  placeholder?: string;
  error?: boolean;
  children: (close: () => void) => React.ReactNode;
  maxHeight?: number;
}

export const DropdownField: React.FC<DropdownFieldProps> = ({
  label,
  value,
  icon,
  placeholder,
  error,
  children,
  maxHeight,
}) => {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const menuContent = children(close);

  return (
    <View onLayout={onLayout}>
      <Menu
        visible={visible}
        onDismiss={close}
        contentStyle={width ? { width } : undefined}
        anchor={
          <Pressable onPress={open}>
            <View pointerEvents="none">
              <TextInput
                label={label}
                value={value}
                mode="outlined"
                right={<TextInput.Icon icon="chevron-down" />}
                left={icon ? <TextInput.Icon icon={icon} /> : undefined}
                editable={false}
                placeholder={placeholder}
                error={error}
              />
            </View>
          </Pressable>
        }
      >
        {maxHeight ? (
          <ScrollView style={{ maxHeight }}>{menuContent}</ScrollView>
        ) : (
          menuContent
        )}
      </Menu>
    </View>
  );
};
