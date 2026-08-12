import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AudioSession,
  LiveKitRoom,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from '@livekit/react-native';
import { ConnectionState } from 'livekit-client';
import { CallControls } from '../components/CallControls';
import { RecentCallResult } from '../phoneTypes';

interface InCallScreenProps {
  label: string;
  code: string;
  serverUrl?: string;
  token?: string;
  phase: 'calling' | 'connecting' | 'active' | 'error';
  errorMessage?: string;
  startedAtIso: string;
  onFinish: (result: RecentCallResult, durationSeconds: number) => void;
}

interface ActiveRoomProps {
  label: string;
  code: string;
  onRequestEnd: () => void;
  onConnected: () => void;
}

function ActiveRoom({ label, code, onRequestEnd, onConnected }: ActiveRoomProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const connectionState = useConnectionState();

  const [elapsed, setElapsed] = useState(0);
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [speakerSupported, setSpeakerSupported] = useState(false);

  const connected = connectionState === ConnectionState.Connected;

  useEffect(() => {
    if (!connected) return;
    onConnected();
    const timer = setInterval(() => setElapsed(seconds => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [connected, onConnected]);

  useEffect(() => {
    const setupSpeakerSupport = async () => {
      const outputs = await AudioSession.getAudioOutputs();
      const supportsSpeaker = outputs.includes('force_speaker') && outputs.includes('default');
      setSpeakerSupported(supportsSpeaker);
    };

    setupSpeakerSupport();
  }, []);

  const toggleSpeaker = async () => {
    if (!speakerSupported) return;

    try {
      const nextValue = !speakerEnabled;
      const output = nextValue ? 'force_speaker' : 'default';
      await AudioSession.selectAudioOutput(output);
      setSpeakerEnabled(nextValue);
    } catch {
      setSpeakerEnabled(false);
    }
  };

  const toggleMute = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      // Keep the UI responsive if a track update fails.
    }
  };

  const end = () => {
    onRequestEnd();
    void room.disconnect();
  };

  const status = useMemo(() => {
    if (connectionState === ConnectionState.Connected) return 'Connected';
    if (connectionState === ConnectionState.Reconnecting) return 'Connecting…';
    if (connectionState === ConnectionState.Connecting) return 'Connecting…';
    return 'Calling…';
  }, [connectionState]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <SafeAreaView style={styles.callSafe}>
      <View style={styles.callContainer}>
        <Text style={styles.wordmark}>Speak</Text>
        <Text style={styles.callLabel}>{label || `Code ${code}`}</Text>
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.timer}>{`${mins}:${String(secs).padStart(2, '0')}`}</Text>
        <Text style={styles.meta}>Participants: {participants.length}</Text>

        <CallControls
          muted={!isMicrophoneEnabled}
          onToggleMute={toggleMute}
          onEnd={end}
          speakerEnabled={speakerEnabled}
          onToggleSpeaker={toggleSpeaker}
          speakerSupported={speakerSupported}
        />

        <TouchableOpacity style={styles.secondaryEnd} onPress={onRequestEnd}>
          <Text style={styles.secondaryEndText}>Disconnect</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export function InCallScreen({
  label,
  code,
  serverUrl,
  token,
  phase,
  errorMessage,
  startedAtIso,
  onFinish,
}: InCallScreenProps) {
  const finalizedRef = useRef(false);
  const connectedRef = useRef(false);
  const hardFailureRef = useRef(false);

  const finalize = async (result: RecentCallResult) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    try {
      await AudioSession.stopAudioSession();
    } catch {
      // Ignore stop errors during teardown.
    }

    const startedAt = Date.parse(startedAtIso);
    const endedAt = Date.now();
    const durationSeconds = connectedRef.current
      ? Math.max(0, Math.floor((endedAt - startedAt) / 1000))
      : 0;

    onFinish(result, durationSeconds);
  };

  const handleConnected = () => {
    connectedRef.current = true;
  };

  const handleDisconnected = async () => {
    if (hardFailureRef.current) {
      await finalize('failed');
      return;
    }

    await finalize(connectedRef.current ? 'completed' : 'canceled');
  };

  const handleError = async () => {
    hardFailureRef.current = true;
    await finalize('failed');
  };

  const requestEnd = async () => {
    await finalize(connectedRef.current ? 'completed' : 'canceled');
  };

  if (phase === 'calling') {
    return (
      <SafeAreaView style={styles.callSafe}>
        <View style={styles.callContainer}>
          <Text style={styles.wordmark}>Speak</Text>
          <Text style={styles.callLabel}>{label || `Code ${code}`}</Text>
          <Text style={styles.status}>Calling…</Text>
          <ActivityIndicator color="#fff" style={styles.loader} />
          <TouchableOpacity style={styles.endAction} onPress={requestEnd}>
            <Text style={styles.endActionText}>End Call</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'error') {
    return (
      <SafeAreaView style={styles.callSafe}>
        <View style={styles.callContainer}>
          <Text style={styles.wordmark}>Speak</Text>
          <Text style={styles.callLabel}>{label || `Code ${code}`}</Text>
          <Text style={styles.status}>Connection failed</Text>
          <Text style={styles.errorText}>{errorMessage || 'Unable to start call.'}</Text>
          <TouchableOpacity style={styles.endAction} onPress={requestEnd}>
            <Text style={styles.endActionText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={handleDisconnected}
      onError={handleError}
      onConnected={handleConnected}
      onMediaDeviceFailure={handleError}
    >
      <ActiveRoom label={label} code={code} onRequestEnd={requestEnd} onConnected={handleConnected} />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  callSafe: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  callContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  wordmark: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },
  callLabel: {
    color: '#d7d7de',
    textAlign: 'center',
    fontSize: 18,
    marginBottom: 10,
  },
  status: {
    color: '#a9d8b8',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  timer: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '300',
    marginBottom: 6,
  },
  meta: {
    color: '#c6c6d0',
    textAlign: 'center',
    marginBottom: 6,
  },
  loader: {
    marginTop: 8,
  },
  errorText: {
    color: '#ffd6d6',
    textAlign: 'center',
    marginBottom: 18,
  },
  endAction: {
    marginTop: 20,
    backgroundColor: '#b42318',
    borderRadius: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryEnd: {
    marginTop: 14,
    alignItems: 'center',
  },
  secondaryEndText: {
    color: '#d2d2db',
  },
});
