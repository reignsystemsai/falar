import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CallButton } from '../components/CallButton';
import { DialPad } from '../components/DialPad';

interface KeypadScreenProps {
  code: string;
  onChangeCode: (value: string) => void;
  onCall: (numericCode: string) => void;
}

function numericDigitsCount(value: string): number {
  return value.replace(/\D/g, '').length;
}

export function KeypadScreen({ code, onChangeCode, onCall }: KeypadScreenProps) {
  const numericCode = code.replace(/\D/g, '');
  const validCode = numericDigitsCount(code) >= 3;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Speak Call Code</Text>
      <Text style={styles.value}>{code || 'Enter code'}</Text>
      <Text style={styles.room}>Room: {numericDigitsCount(code) >= 1 ? `speak-${numericCode}` : 'speak-<code>'}</Text>

      <View style={styles.padWrap}>
        <DialPad
          onPressKey={key => onChangeCode(`${code}${key}`)}
          onDelete={() => onChangeCode(code.slice(0, -1))}
        />
      </View>

      <CallButton disabled={!validCode} onPress={() => onCall(numericCode)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  value: {
    minHeight: 40,
    fontSize: 34,
    fontWeight: '300',
    color: '#1a1a2e',
  },
  room: {
    fontSize: 13,
    color: '#555',
    marginBottom: 14,
  },
  padWrap: {
    marginTop: 10,
  },
});
