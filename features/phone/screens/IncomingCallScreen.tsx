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
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.topIconButton} onPress={onBack}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.brand}>S</Text>
      <Text style={styles.speakText}>Speak</Text>
      <Text style={styles.eyebrow}>INCOMING CALL</Text>

      <View style={styles.avatarRing}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{initials(contact.name)}</Text>
        </View>
      </View>

      <Text style={styles.name}>{contact.name}</Text>
      <Text style={styles.number}>{contact.number}</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionWrap} onPress={onDecline}>
          <View style={styles.declineButton}>
            <Ionicons name="call" size={22} color={colors.text} />
          </View>
          <Text style={styles.actionText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionWrap} onPress={onAnswer}>
          <View style={styles.answerButton}>
            <Ionicons name="call" size={22} color={colors.text} />
          </View>
          <Text style={styles.actionText}>Answer</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.pagerDots}>
        <View style={styles.pagerDot} />
        <View style={[styles.pagerDot, styles.pagerDotActive]} />
        <View style={styles.pagerDot} />
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
    paddingTop: 16,
  },
  topRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topIconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brand: {
    color: colors.cyan,
    fontSize: 54,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: colors.blue,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  speakText: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: -6,
  },
  eyebrow: {
    marginTop: 2,
    textAlign: 'center',
    color: colors.blue,
    fontWeight: '700',
    letterSpacing: 1,
  },
  avatarRing: {
    alignSelf: 'center',
    width: 188,
    height: 188,
    borderRadius: 94,
    borderWidth: 1,
    borderColor: colors.blueDeep,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 114,
    height: 114,
    borderRadius: 57,
    borderWidth: 1,
    borderColor: colors.cyan,
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
    fontSize: 48,
    textAlign: 'center',
    fontWeight: '700',
  },
  number: {
    color: colors.secondary,
    fontSize: 28,
    textAlign: 'center',
    marginTop: 6,
  },
  actionRow: {
    marginTop: 26,
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 24,
  },
  actionWrap: {
    alignItems: 'center',
    gap: 10,
  },
  declineButton: {
    width: 84,
    height: 84,
    borderRadius: radius.circle,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerButton: {
    width: 84,
    height: 84,
    borderRadius: radius.circle,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 18,
  },
  pagerDots: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  pagerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.blueDeep,
  },
  pagerDotActive: {
    backgroundColor: colors.cyan,
  },
});
