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
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons name="chevron-back" size={22} color={colors.secondary} />
      </TouchableOpacity>

      <Text style={styles.brand}>S</Text>
      <Text style={styles.name}>{contact.name}</Text>
      <Text style={styles.number}>{contact.number}</Text>
      <Text style={styles.duration}>{`${mins}:${String(secs).padStart(2, '0')}`}</Text>

      <View style={styles.centerOrb}>
        <Text style={styles.wave}>▂▅▇▅▂</Text>
      </View>

      <View style={styles.controlsGrid}>
        <TouchableOpacity style={styles.controlButton} onPress={onMute}>
          <Ionicons name={muted ? 'mic-off' : 'mic'} size={18} color={colors.text} />
          <Text style={styles.controlText}>{muted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.endButton} onPress={onEndCall}>
        <Ionicons name="call" size={18} color={colors.text} />
        <Text style={styles.endButtonText}>End Call</Text>
      </TouchableOpacity>
    </View>
  );
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
  name: {
    marginTop: 20,
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
  duration: {
    marginTop: 8,
    color: colors.text,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '300',
  },
  centerOrb: {
    alignSelf: 'center',
    width: 148,
    height: 148,
    borderRadius: 74,
    marginTop: 18,
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
    fontSize: 36,
  },
  controlsGrid: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  controlButton: {
    minWidth: 150,
    minHeight: 56,
    borderRadius: radius.circle,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    color: colors.text,
    fontWeight: '700',
  },
  endButton: {
    marginTop: 16,
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
