import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SpeakPhoneTheme } from '../speakPhoneTheme';

const { colors } = SpeakPhoneTheme;

interface CallButtonProps {
  disabled: boolean;
  onPress: () => void;
}

export function CallButton({ disabled, onPress }: CallButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.text}>CALL</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.green,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginTop: 10,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
