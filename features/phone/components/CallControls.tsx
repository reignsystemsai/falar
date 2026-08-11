import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CallControlsProps {
  muted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
  speakerEnabled: boolean;
  onToggleSpeaker: () => void;
  speakerSupported: boolean;
}

export function CallControls({
  muted,
  onToggleMute,
  onEnd,
  speakerEnabled,
  onToggleSpeaker,
  speakerSupported,
}: CallControlsProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.control} onPress={onToggleMute}>
        <Text style={styles.icon}>{muted ? '🔇' : '🎙'}</Text>
        <Text style={styles.label}>{muted ? 'Unmute' : 'Mute'}</Text>
      </TouchableOpacity>

      {speakerSupported ? (
        <TouchableOpacity style={styles.control} onPress={onToggleSpeaker}>
          <Text style={styles.icon}>🔊</Text>
          <Text style={styles.label}>{speakerEnabled ? 'Speaker On' : 'Speaker Off'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.control, styles.disabled]}>
          <Text style={styles.icon}>🔊</Text>
          <Text style={styles.label}>Speaker Auto</Text>
        </View>
      )}

      <TouchableOpacity style={[styles.control, styles.end]} onPress={onEnd}>
        <Text style={styles.icon}>📵</Text>
        <Text style={[styles.label, styles.endText]}>End</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 26,
    gap: 12,
  },
  control: {
    flex: 1,
    minHeight: 80,
    borderRadius: 14,
    backgroundColor: '#2a2a44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.7,
  },
  end: {
    backgroundColor: '#b42318',
  },
  icon: {
    fontSize: 24,
  },
  label: {
    marginTop: 6,
    color: '#d6d6dc',
    fontWeight: '600',
    fontSize: 12,
  },
  endText: {
    color: '#fff',
  },
});
