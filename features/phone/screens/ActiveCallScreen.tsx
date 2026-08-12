import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SpeakPhoneTheme } from '../speakPhoneTheme';

const { colors, radius } = SpeakPhoneTheme;

type SpeakContact = {
  name: string;
  number: string;
};

type ActiveCallScreenProps = {
  contact: SpeakContact;
  durationSeconds: number;
  muted: boolean;
  onBack: () => void;
  onMute: () => void;
  onEndCall: () => void;
};

export function ActiveCallScreen({
  contact,
  durationSeconds,
  muted,
  onBack,
  onMute,
  onEndCall,
}: ActiveCallScreenProps) {
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.topIconButton} onPress={onBack}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.secondary} />
        </TouchableOpacity>
        <View style={styles.topSpacer} />
        <TouchableOpacity style={styles.topIconButton}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.brand}>S</Text>
      <Text style={styles.speakText}>Speak</Text>
      <Text style={styles.name}>{contact.name}</Text>
      <Text style={styles.number}>{contact.number}</Text>
      <Text style={styles.duration}>{`${mins}:${String(secs).padStart(2, '0')}`}</Text>

      <View style={styles.centerOrb}>
        <Text style={styles.wave}>▂▅▇▅▂</Text>
        <Text style={styles.speakingText}>Speaking</Text>
      </View>

      <View style={styles.encryptionPill}>
        <Ionicons name="lock-closed-outline" size={12} color={colors.secondary} />
        <Text style={styles.encryptionText}>End-to-end Encrypted</Text>
      </View>

      <View style={styles.controlsGrid}>
        <TouchableOpacity style={styles.controlButton} onPress={onMute}>
          <Ionicons name={muted ? 'mic-off' : 'mic'} size={18} color={colors.secondary} />
          <Text style={styles.controlText}>{muted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="volume-high" size={18} color={colors.secondary} />
          <Text style={styles.controlText}>Speaker</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="keypad" size={18} color={colors.secondary} />
          <Text style={styles.controlText}>Keypad</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}>
          <Ionicons name="add" size={18} color={colors.secondary} />
          <Text style={styles.controlText}>Add Call</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.endButton} onPress={onEndCall}>
        <Ionicons name="call" size={18} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.endButtonText}>End Call</Text>
      <Text style={styles.endHint}>Tap to end the call</Text>
    </View>
  );
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
    fontSize: 52,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: 8,
    textShadowColor: colors.blue,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  speakText: {
    color: colors.text,
    fontSize: 34,
    textAlign: 'center',
    fontWeight: '700',
    marginTop: -8,
  },
  name: {
    marginTop: 10,
    color: colors.text,
    fontSize: 32,
    textAlign: 'center',
    fontWeight: '700',
  },
  number: {
    color: colors.secondary,
    fontSize: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  duration: {
    marginTop: 8,
    color: colors.text,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '300',
  },
  centerOrb: {
    alignSelf: 'center',
    width: 170,
    height: 170,
    borderRadius: 85,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.blueDeep,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.blue,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  wave: {
    color: colors.cyan,
    fontSize: 34,
  },
  speakingText: {
    color: colors.text,
    marginTop: 4,
    fontSize: 14,
  },
  encryptionPill: {
    marginTop: 14,
    minHeight: 30,
    borderRadius: radius.circle,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignSelf: 'center',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  encryptionText: {
    color: colors.secondary,
    fontSize: 12,
  },
  controlsGrid: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  controlButton: {
    flex: 1,
    minHeight: 62,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    color: colors.secondary,
    fontWeight: '600',
    fontSize: 12,
  },
  endButton: {
    marginTop: 18,
    width: 72,
    height: 72,
    alignSelf: 'center',
    borderRadius: radius.circle,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 22,
    textAlign: 'center',
    marginTop: 8,
  },
  endHint: {
    color: colors.secondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
  },
});
