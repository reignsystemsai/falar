import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SpeakPhoneTheme } from '../speakPhoneTheme';

const { colors } = SpeakPhoneTheme;

type SpeakContact = {
  name: string;
  number: string;
};

type OutgoingCallScreenProps = {
  contact: SpeakContact;
  onMute: () => void;
  onSpeaker: () => void;
  onKeypad: () => void;
  onEndCall: () => void;
};

export function OutgoingCallScreen({
  contact,
  onMute,
  onSpeaker,
  onKeypad,
  onEndCall,
}: OutgoingCallScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>S Speak</Text>
      <Text style={styles.title}>Outgoing Call</Text>

      <View style={styles.avatarWrap}>
        <Text style={styles.avatarText}>{initials(contact.name)}</Text>
      </View>

      <Text style={styles.name}>{contact.name}</Text>
      <Text style={styles.number}>{contact.number}</Text>

      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.controlButton} onPress={onMute}>
          <Text style={styles.controlText}>Mute</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={onSpeaker}>
          <Text style={styles.controlText}>Speaker</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={onKeypad}>
          <Text style={styles.controlText}>Keypad</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.endButton} onPress={onEndCall}>
        <Text style={styles.endButtonText}>End Call</Text>
      </TouchableOpacity>
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
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 16,
    textAlign: 'center',
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
  controlRow: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    color: colors.text,
    fontWeight: '700',
  },
  endButton: {
    marginTop: 18,
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
});
