import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SpeakPhoneTheme } from '../speakPhoneTheme';

const { colors } = SpeakPhoneTheme;

type SpeakContact = {
  name: string;
  number: string;
};

type ActiveCallScreenProps = {
  contact: SpeakContact;
  durationSeconds: number;
  muted: boolean;
  speaker: boolean;
  onMute: () => void;
  onSpeaker: () => void;
  onKeypad: () => void;
  onAddCall: () => void;
  onEndCall: () => void;
};

export function ActiveCallScreen({
  contact,
  durationSeconds,
  muted,
  speaker,
  onMute,
  onSpeaker,
  onKeypad,
  onAddCall,
  onEndCall,
}: ActiveCallScreenProps) {
  const mins = Math.floor(durationSeconds / 60);
  const secs = durationSeconds % 60;

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>S Speak</Text>
      <Text style={styles.name}>{contact.name}</Text>
      <Text style={styles.number}>{contact.number}</Text>
      <Text style={styles.duration}>{`${mins}:${String(secs).padStart(2, '0')}`}</Text>

      <View style={styles.centerOrb}>
        <Text style={styles.wave}>▂▅▇▅▂</Text>
      </View>

      <View style={styles.controlsGrid}>
        <TouchableOpacity style={styles.controlButton} onPress={onMute}>
          <Text style={styles.controlText}>{muted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={onSpeaker}>
          <Text style={styles.controlText}>{speaker ? 'Speaker On' : 'Speaker'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={onKeypad}>
          <Text style={styles.controlText}>Keypad</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={onAddCall}>
          <Text style={styles.controlText}>Add Call</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.endButton} onPress={onEndCall}>
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
  brand: {
    color: colors.cyan,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  controlButton: {
    width: '48%',
    minHeight: 56,
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
    marginTop: 16,
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
