import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
    rowGap: 10,
  },
  key: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#f0f2f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 30,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  deleteButton: {
    marginTop: 14,
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  deleteText: {
    color: '#c53030',
    fontWeight: '700',
  },
});
