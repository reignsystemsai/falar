import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PhoneTabKey } from './phoneTypes';
import { SpeakPhoneTheme } from './speakPhoneTheme';

const { colors } = SpeakPhoneTheme;

interface PhoneTabsProps {
  activeTab: PhoneTabKey;
  onChange: (tab: PhoneTabKey) => void;
}

const TABS: Array<{ key: PhoneTabKey; label: string }> = [
  { key: 'favorites', label: 'Favorites' },
  { key: 'recents', label: 'Recents' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'keypad', label: 'Keypad' },
];

export function PhoneTabs({ activeTab, onChange }: PhoneTabsProps) {
  return (
    <View style={styles.container}>
      {TABS.map(tab => {
        const active = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(tab.key)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  tabActive: {
    borderTopWidth: 2,
    borderTopColor: colors.cyan,
  },
  label: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '500',
  },
  labelActive: {
    color: colors.text,
    fontWeight: '700',
  },
});
