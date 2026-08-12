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
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.topIconButton} onPress={onBack}>
          <Ionicons name="chevron-down" size={20} color={colors.secondary} />
        </TouchableOpacity>
        <View style={styles.topSpacer} />
        <TouchableOpacity style={styles.topIconButton}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.brand}>S</Text>
      <Text style={styles.title}>Outgoing Call</Text>

      <View style={styles.avatarRing}>
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{initials(contact.name)}</Text>
        </View>
      </View>

      <Text style={styles.name}>{contact.name}</Text>
      <Text style={styles.number}>{contact.number}</Text>
      <Text style={styles.stateText}>Calling...</Text>

      <View style={styles.controlsRow}>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="mic-off" size={18} color={colors.secondary} />
          <Text style={styles.controlLabel}>Mute</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="volume-high" size={18} color={colors.secondary} />
          <Text style={styles.controlLabel}>Speaker</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="keypad" size={18} color={colors.secondary} />
          <Text style={styles.controlLabel}>Keypad</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.endButton} onPress={onEndCall}>
        <Ionicons name="call" size={20} color={colors.text} />
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
    paddingTop: 16,
  },
  topRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topSpacer: {
    flex: 1,
  },
  topIconButton: {
    width: 34,
    height: 34,
    borderRadius: radius.circle,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: colors.cyan,
    fontSize: 56,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: colors.blue,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  title: {
    color: colors.secondary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  avatarRing: {
    alignSelf: 'center',
    width: 170,
    height: 170,
    borderRadius: 85,
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.blueDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: colors.cyan,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.blue,
    shadowOpacity: 0.8,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarText: {
    color: colors.cyan,
    fontWeight: '700',
    fontSize: 34,
  },
  name: {
    marginTop: 18,
    color: colors.text,
    fontSize: 38,
    textAlign: 'center',
    fontWeight: '700',
  },
  number: {
    color: colors.secondary,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  stateText: {
    color: colors.blue,
    textAlign: 'center',
    marginTop: 10,
    fontSize: 24,
    fontWeight: '600',
  },
  controlsRow: {
    marginTop: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    minHeight: 66,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  controlLabel: {
    color: colors.secondary,
    fontSize: 12,
  },
  endButton: {
    marginTop: 20,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: radius.circle,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
