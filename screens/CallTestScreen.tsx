import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import {
  AudioSession,
  LiveKitRoom,
  useParticipants,
  useLocalParticipant,
  useConnectionState,
  useRoomContext,
} from '@livekit/react-native';
import { ConnectionState } from 'livekit-client';
import { getLiveKitToken } from '../lib/livekit';

const ROOM_NAME = 'speak-first-call';

// ─── Active call controls — must be inside LiveKitRoom context ───────────────

function ActiveCallView({ onDisconnect }: { onDisconnect: () => void }) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const participants = useParticipants();
  const connectionState = useConnectionState();
  const [elapsed, setElapsed] = useState(0);

  const isConnected = connectionState === ConnectionState.Connected;

  useEffect(() => {
    if (!isConnected) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isConnected]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const endCall = useCallback(async () => {
    await room.disconnect();
    // onDisconnect fired by LiveKitRoom.onDisconnected
  }, [room]);

  const toggleMute = useCallback(() => {
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  }, [localParticipant, isMicrophoneEnabled]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.callContainer}>
        {/* Header */}
        <Text style={styles.wordmark}>Speak</Text>

        {/* Status */}
        {isConnected ? (
          <View style={styles.connectedBadge}>
            <View style={styles.dot} />
            <Text style={styles.connectedText}>Connected</Text>
          </View>
        ) : (
          <Text style={styles.connectingText}>
            {connectionState === ConnectionState.Reconnecting
              ? 'Reconnecting…'
              : 'Connecting…'}
          </Text>
        )}

        {/* Timer */}
        {isConnected && (
          <Text style={styles.timer}>{formatTime(elapsed)}</Text>
        )}

        {/* Participant count */}
        <Text style={styles.participants}>
          Participants: {participants.length}
        </Text>

        {/* Call controls */}
        <View style={styles.controls}>
          {/* Mute / Unmute */}
          <TouchableOpacity
            style={[styles.controlButton, !isMicrophoneEnabled && styles.controlButtonActive]}
            onPress={toggleMute}
            disabled={!isConnected}
          >
            <Text style={styles.controlIcon}>
              {isMicrophoneEnabled ? '🎙' : '🔇'}
            </Text>
            <Text style={styles.controlLabel}>
              {isMicrophoneEnabled ? 'Mute' : 'Unmute'}
            </Text>
          </TouchableOpacity>

          {/* Audio indicator (speaker routing requires additional native dep) */}
          <View style={[styles.controlButton, styles.controlButtonInert]}>
            <Text style={styles.controlIcon}>🔊</Text>
            <Text style={styles.controlLabel}>Audio Active</Text>
          </View>

          {/* End Call */}
          <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={endCall}>
            <Text style={styles.controlIcon}>📵</Text>
            <Text style={[styles.controlLabel, styles.endLabel]}>End Call</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Root screen ─────────────────────────────────────────────────────────────

type CallPhase = 'idle' | 'connecting' | 'active' | 'error';

export default function CallTestScreen() {
  // Call
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    startCall();
  }, []);

  // ── Start call ───────────────────────────────────────────────────────────
  const startCall = async () => {
    if (phase !== 'idle') return;
    setPhase('connecting');
    setErrorMsg('');
    try {
      const creds = await getLiveKitToken(ROOM_NAME);
      await AudioSession.startAudioSession();
      setServerUrl(creds.serverUrl);
      setToken(creds.participantToken);
      setPhase('active');
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Failed to connect');
      setPhase('error');
    }
  };

  // ── End call (also called by LiveKitRoom.onDisconnected) ─────────────────
  const endCall = useCallback(async () => {
    await AudioSession.stopAudioSession();
    setToken('');
    setServerUrl('');
    setPhase('idle');
    setErrorMsg('');
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN 3 — Active Call (inside LiveKitRoom context)
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'active' && serverUrl && token) {
    return (
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect={true}
        audio={true}
        video={false}
        onDisconnected={endCall}
      >
        <ActiveCallView onDisconnect={endCall} />
      </LiveKitRoom>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SCREEN 2 — Ready / Connecting / Error
  // ════════════════════════════════════════════════════════════════════════════
  const statusLabel =
    phase === 'connecting' ? 'Connecting…'
    : phase === 'error'    ? 'Connection failed'
    : 'Ready to call';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.centered}>
        <Text style={styles.wordmark}>Speak</Text>

        <Text style={styles.statusLabel}>
          Status:{' '}
          <Text style={phase === 'error' ? styles.errorText : styles.statusValue}>
            {statusLabel}
          </Text>
        </Text>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <TouchableOpacity
          style={[styles.callButton, phase === 'connecting' && styles.buttonDisabled]}
          onPress={startCall}
          disabled={phase === 'connecting'}
          activeOpacity={0.85}
        >
          {phase === 'connecting'
            ? <ActivityIndicator color="#fff" size="large" />
            : <Text style={styles.callButtonText}>CALL TEST</Text>}
        </TouchableOpacity>

        {phase === 'error' && (
          <TouchableOpacity onPress={() => setPhase('idle')}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const BRAND = '#1A1A2E';
const ACCENT = '#3ECF8E';
const DANGER = '#E53E3E';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9F9F9' },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  // wordmark
  wordmark: {
    fontSize: 38,
    fontWeight: '800',
    color: BRAND,
    letterSpacing: 1,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    color: '#777',
    marginBottom: 36,
  },

  // inputs
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#fff',
    marginBottom: 14,
  },

  // primary (sign-in) button
  primaryButton: {
    width: '100%',
    backgroundColor: BRAND,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 1,
  },

  // large call button
  callButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  callButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 1.5,
  },

  buttonDisabled: { opacity: 0.6 },

  // status
  statusLabel: { fontSize: 16, color: '#555', marginBottom: 4 },
  statusValue: { color: BRAND, fontWeight: '600' },

  // error
  errorText: { color: DANGER, fontSize: 14, textAlign: 'center', marginBottom: 8 },

  retryText: { color: ACCENT, fontSize: 14, marginTop: 12 },

  // sign out
  signOutButton: { marginTop: 48 },
  signOutText: { color: '#BBB', fontSize: 13 },

  // ── Active call ───────────────────────────────────────────────────────────

  callContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: BRAND,
  },

  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
    marginRight: 8,
  },
  connectedText: { color: ACCENT, fontWeight: '600', fontSize: 16 },
  connectingText: { color: '#aaa', fontSize: 16, marginTop: 16, marginBottom: 8 },

  timer: { color: '#fff', fontSize: 28, fontWeight: '200', marginVertical: 8 },

  participants: { color: '#aaa', fontSize: 15, marginBottom: 48 },

  // call controls row
  controls: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-end',
  },

  controlButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#2A2A44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: { backgroundColor: '#3A3A5A' },
  controlButtonInert: { opacity: 0.55 },

  endButton: { backgroundColor: DANGER },

  controlIcon: { fontSize: 26 },
  controlLabel: { color: '#ccc', fontSize: 11, marginTop: 4 },
  endLabel: { color: '#fff' },
});
