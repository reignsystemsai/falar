import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SpeakPhoneTheme } from '../speakPhoneTheme';

const { colors } = SpeakPhoneTheme;

interface DialPadProps {
  onPressKey: (value: string) => void;
  onDelete: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function DialPad({ onPressKey, onDelete }: DialPadProps) {
  return (
    <View>
      <View style={styles.grid}>
        {KEYS.map(key => (
          <TouchableOpacity key={key} style={styles.key} onPress={() => onPressKey(key)}>
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteText}>DELETE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  key: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 30,
    color: colors.text,
    fontWeight: '500',
  },
  deleteButton: {
    marginTop: 14,
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  deleteText: {
    color: colors.cyan,
    fontWeight: '700',
  },
});
