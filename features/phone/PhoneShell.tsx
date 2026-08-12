import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AudioSession } from '@livekit/react-native';
import { supabase } from '../../lib/supabase';
import { getLiveKitToken } from '../../lib/livekit';
import { InCallScreen } from './screens/InCallScreen';
import { KeypadScreen } from './screens/KeypadScreen';

function normalizeVisibleCode(value: string): string {
  return value.replace(/[^\d*#]/g, '');
}

export function PhoneShell() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(true);

  const [myCode, setMyCode] = useState('------');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [outgoing, setOutgoing] = useState<{ peerCode: string; roomName: string } | null>(null);
  const [incoming, setIncoming] = useState<{ peerCode: string; roomName: string } | null>(null);

  const [currentCall, setCurrentCall] = useState<{
    code: string;
    roomName: string;
    label: string;
    phase: 'calling' | 'connecting' | 'active' | 'error';
    startedAtIso: string;
    serverUrl?: string;
    token?: string;
    errorMessage?: string;
  } | null>(null);

  const deriveSpeakCode = (value: string): string => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) % 1000000;
    }
    return String(hash).padStart(6, '0');
  };

  const ensureSession = async () => {
    const {
      data: { session: existingSession },
    } = await supabase.auth.getSession();

    if (existingSession?.access_token && existingSession.user?.id) {
      return existingSession;
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session?.access_token || !data.user) {
      throw new Error('Unable to initialize call session.');
    }

    return data.session;
  };

  const sendSignal = async (payload: Record<string, string>) => {
    if (!channelRef.current) {
      return;
    }
    await channelRef.current.send({ type: 'broadcast', event: 'call', payload });
  };

  const beginRoomJoin = async (peerCode: string, roomName: string) => {
    const startedAtIso = new Date().toISOString();

    setCurrentCall({
      code: peerCode,
      roomName,
      label: `Speak ${peerCode}`,
      phase: 'calling',
      startedAtIso,
    });

    try {
      const token = await getLiveKitToken(roomName);
      await AudioSession.startAudioSession();

      if (!mountedRef.current) return;

      setCurrentCall({
        code: peerCode,
        roomName,
        label: `Speak ${peerCode}`,
        phase: 'connecting',
        startedAtIso,
        serverUrl: token.serverUrl,
        token: token.participantToken,
      });
    } catch {
      if (!mountedRef.current) return;
      setCurrentCall({
        code: peerCode,
        roomName,
        label: `Speak ${peerCode}`,
        phase: 'error',
        startedAtIso,
        errorMessage: 'Unable to start call.',
      });
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    const setup = async () => {
      const session = await ensureSession();
      const localCode = deriveSpeakCode(session.user.id);

      if (!mountedRef.current) return;
      setMyCode(localCode);

      const channel = supabase.channel('speak-phone-calls');
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'call' }, ({ payload }) => {
          if (!mountedRef.current || !payload || typeof payload !== 'object') {
            return;
          }

          const to = typeof payload.to === 'string' ? payload.to : '';
          const from = typeof payload.from === 'string' ? payload.from : '';
          const roomName = typeof payload.roomName === 'string' ? payload.roomName : '';
          const type = typeof payload.type === 'string' ? payload.type : '';

          if (!to || !from || !roomName || to !== localCode) {
            return;
          }

          if (type === 'invite') {
            setIncoming({ peerCode: from, roomName });
            setNotice('Incoming call');
            return;
          }

          if (type === 'answer') {
            setOutgoing(current => {
              if (!current || current.peerCode !== from || current.roomName !== roomName) {
                return current;
              }
              void beginRoomJoin(from, roomName);
              return null;
            });
            return;
          }

          if (type === 'decline') {
            setOutgoing(current => {
              if (!current || current.peerCode !== from || current.roomName !== roomName) {
                return current;
              }
              setNotice('Call declined.');
              return null;
            });
            return;
          }

          if (type === 'end') {
            setNotice('Call ended.');
          }
        })
        .subscribe();
    };

    void setup();

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
      }
      channelRef.current = null;
    };
  }, []);

  const startCall = async (targetCode: string) => {
    if (targetCode.length !== 6 || targetCode === myCode) {
      setNotice('Enter another 6-digit Speak number.');
      return;
    }

    const roomName = `speak-${[myCode, targetCode].sort().join('-')}`;
    setNotice('Calling...');
    setOutgoing({ peerCode: targetCode, roomName });

    await sendSignal({ type: 'invite', from: myCode, to: targetCode, roomName });
  };

  const finishCall = async (
    _number: string,
    _startedAtIso: string,
    _durationSeconds: number,
    result: 'completed' | 'failed' | 'canceled'
  ) => {
    if (currentCall) {
      await sendSignal({
        type: 'end',
        from: myCode,
        to: currentCall.code,
        roomName: currentCall.roomName,
      });
    }

    setCurrentCall(null);
    setOutgoing(null);
    setIncoming(null);

    if (result === 'failed') {
      setNotice('Connection failed.');
      return;
    }

    if (result === 'completed') {
      setNotice('Call ended.');
      return;
    }

    setNotice('Call ended.');
  };

  if (currentCall) {
    return (
      <InCallScreen
        label={currentCall.label}
        code={currentCall.code}
        serverUrl={currentCall.serverUrl}
        token={currentCall.token}
        phase={currentCall.phase}
        errorMessage={currentCall.errorMessage}
        startedAtIso={currentCall.startedAtIso}
        onFinish={(result, durationSeconds) =>
          finishCall(currentCall.code, currentCall.startedAtIso, durationSeconds, result)
        }
      />
    );
  }

  if (incoming) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>Speak</Text>
        </View>
        <View style={styles.contentCenter}>
          <Text style={styles.incomingTitle}>Incoming Call</Text>
          <Text style={styles.incomingFrom}>From {incoming.peerCode}</Text>
          <TouchableOpacity
            style={styles.answerButton}
            onPress={async () => {
              const call = incoming;
              setIncoming(null);
              setOutgoing(null);
              await sendSignal({ type: 'answer', from: myCode, to: call.peerCode, roomName: call.roomName });
              await beginRoomJoin(call.peerCode, call.roomName);
            }}
          >
            <Text style={styles.answerText}>Answer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={async () => {
              const call = incoming;
              setIncoming(null);
              await sendSignal({ type: 'decline', from: myCode, to: call.peerCode, roomName: call.roomName });
              setNotice('Call declined.');
            }}
          >
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (outgoing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>Speak</Text>
        </View>
        <View style={styles.contentCenter}>
          <Text style={styles.incomingTitle}>Calling {outgoing.peerCode}</Text>
          <Text style={styles.incomingFrom}>Waiting for answer...</Text>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={async () => {
              const call = outgoing;
              setOutgoing(null);
              await sendSignal({ type: 'decline', from: myCode, to: call.peerCode, roomName: call.roomName });
              setNotice('Call canceled.');
            }}
          >
            <Text style={styles.declineText}>End</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const cleanCode = normalizeVisibleCode(code).replace(/\D/g, '').slice(0, 6);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>Speak</Text>
        <Text style={styles.localCode}>#{myCode}</Text>
      </View>

      {notice ? (
        <View style={styles.noticeWrap}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.content}>
        <KeypadScreen
          code={cleanCode}
          onChangeCode={value => setCode(normalizeVisibleCode(value).replace(/\D/g, '').slice(0, 6))}
          onCall={value => {
            void startCall(value.replace(/\D/g, '').slice(0, 6));
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#ececec',
  },
  wordmark: {
    fontSize: 30,
    color: '#1a1a2e',
    fontWeight: '800',
  },
  localCode: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  contentCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  noticeWrap: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  noticeText: {
    color: '#334155',
    fontSize: 13,
  },
  incomingTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  incomingFrom: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 18,
  },
  answerButton: {
    width: 180,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#0f8f4e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  answerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  declineButton: {
    width: 180,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#b42318',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
