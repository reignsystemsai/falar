import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SpeakPhoneTheme } from '../speakPhoneTheme';

const { colors, radius } = SpeakPhoneTheme;

type SpeakContact = {
  name: string;
  number: string;
};

type OutgoingCallScreenProps = {
  contact: SpeakContact;
  onBack: () => void;
  onEndCall: () => void;
};

export function OutgoingCallScreen({
  contact,
  onBack,
  onEndCall,
}: OutgoingCallScreenProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={22} color={colors.secondary} />
      </TouchableOpacity>

      <Text style={styles.brand}>S</Text>
      <Text style={styles.title}>Outgoing Call</Text>

      <View style={styles.avatarWrap}>
        <Text style={styles.avatarText}>{initials(contact.name)}</Text>
      </View>

      <Text style={styles.name}>{contact.name}</Text>
      <Text style={styles.number}>{contact.number}</Text>
      <Text style={styles.stateText}>Calling...</Text>

      <TouchableOpacity style={styles.endButton} onPress={onEndCall}>
        <Ionicons name="close" size={20} color={colors.text} />
        <Text style={styles.endButtonText}>Cancel</Text>
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
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
  },
  avatarWrap: {
    alignSelf: 'center',
    width: 118,
    height: 118,
    borderRadius: 59,
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
  stateText: {
    color: colors.secondary,
    textAlign: 'center',
    marginTop: 8,
    fontSize: 16,
  },
  endButton: {
    marginTop: 30,
    alignSelf: 'center',
    minWidth: 170,
    minHeight: 56,
    borderRadius: radius.circle,
    backgroundColor: colors.red,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
});
