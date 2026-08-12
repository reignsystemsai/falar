import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SpeakPhoneTheme } from '../speakPhoneTheme';

const { colors } = SpeakPhoneTheme;

type SpeakContact = {
  name: string;
  number: string;
};

type IncomingCallScreenProps = {
  contact: SpeakContact;
  onAnswer: () => void;
  onDecline: () => void;
};

export function IncomingCallScreen({ contact, onAnswer, onDecline }: IncomingCallScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>S Speak</Text>
      <Text style={styles.eyebrow}>INCOMING CALL</Text>

      <View style={styles.avatarWrap}>
        <Text style={styles.avatarText}>{initials(contact.name)}</Text>
      </View>

      <Text style={styles.name}>{contact.name}</Text>
      <Text style={styles.number}>{contact.number}</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
          <Text style={styles.actionText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.answerButton} onPress={onAnswer}>
          <Text style={styles.actionText}>Answer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  brand: {
    color: colors.cyan,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  eyebrow: {
    marginTop: 18,
    textAlign: 'center',
    color: colors.secondary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  avatarWrap: {
    alignSelf: 'center',
    width: 108,
    height: 108,
    borderRadius: 54,
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.cyan,
    fontWeight: '700',
    fontSize: 34,
  },
  name: {
    marginTop: 16,
    color: colors.text,
    fontSize: 24,
    textAlign: 'center',
    fontWeight: '700',
  },
  number: {
    color: colors.secondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 6,
  },
  actionRow: {
    marginTop: 34,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
});
