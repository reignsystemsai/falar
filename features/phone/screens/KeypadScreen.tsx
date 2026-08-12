import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CallButton } from '../components/CallButton';
import { DialPad } from '../components/DialPad';
import { SpeakPhoneTheme } from '../speakPhoneTheme';

const { colors } = SpeakPhoneTheme;

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
      <Text style={styles.label}>Speak</Text>
      <Text style={styles.eyebrow}>KEYPAD</Text>
      <Text style={styles.value}>{code || 'Enter code'}</Text>
      <Text style={styles.room}>{numericDigitsCount(code) >= 1 ? `Room: speak-${numericCode}` : 'Room: speak-<code>'}</Text>

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
    paddingTop: 12,
    backgroundColor: colors.background,
  },
  label: {
    fontSize: 30,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  eyebrow: {
    color: colors.secondary,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 1,
  },
  value: {
    minHeight: 40,
    fontSize: 34,
    fontWeight: '300',
    color: colors.text,
    textAlign: 'center',
  },
  room: {
    fontSize: 13,
    color: colors.muted,
    marginBottom: 12,
    textAlign: 'center',
  },
  padWrap: {
    marginTop: 10,
  },
});
