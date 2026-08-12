import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SpeakPhoneTheme } from '../speakPhoneTheme';

const { colors, radius } = SpeakPhoneTheme;

type SpeakContact = {
  name: string;
  number: string;
};

type IncomingCallScreenProps = {
  contact: SpeakContact;
  onBack: () => void;
  onAnswer: () => void;
  onDecline: () => void;
};

export function IncomingCallScreen({ contact, onBack, onAnswer, onDecline }: IncomingCallScreenProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={22} color={colors.secondary} />
      </TouchableOpacity>

      <Text style={styles.brand}>S</Text>
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
  backButton: {
    alignSelf: 'flex-start',
    width: 36,
    height: 36,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brand: {
    color: colors.cyan,
    fontSize: 64,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: colors.blue,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  eyebrow: {
    marginTop: 6,
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
    borderRadius: radius.circle,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.circle,
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
