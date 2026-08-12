import * as Contacts from 'expo-contacts/legacy';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AudioSession } from '@livekit/react-native';
import { supabase } from '../../lib/supabase';
import { getLiveKitToken } from '../../lib/livekit';
import { InCallScreen } from './screens/InCallScreen';

type LoadState = 'loading' | 'ready' | 'error';

type DeviceContact = {
  id: string;
  name: string;
  phoneE164: string;
};

type SpeakContact = DeviceContact & {
  userId: string;
};

type CallSignalPayload = {
  type: 'invite' | 'accepted' | 'declined' | 'ended';
  fromUserId: string;
  toUserId: string;
  roomName: string;
  fromName?: string;
  fromPhone?: string;
};

type ActiveCall = {
  peerUserId: string;
  peerLabel: string;
  roomName: string;
  startedAtIso: string;
  phase: 'calling' | 'connecting' | 'active' | 'error';
  token?: string;
  serverUrl?: string;
  errorMessage?: string;
};

function normalizeToE164(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (trimmed.startsWith('+')) {
    if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
    if (digits.startsWith('57') && digits.length === 12) return `+${digits}`;
    return null;
  }

  if (digits.startsWith('001') && digits.length === 13) return `+${digits.slice(2)}`;
  if (digits.startsWith('0057') && digits.length === 14) return `+${digits.slice(2)}`;
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  if (digits.startsWith('57') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith('3')) return `+57${digits}`;
  if (digits.length === 10) return `+1${digits}`;

  return null;
}

async function ensureSession() {
  const {
    data: { session: existingSession },
  } = await supabase.auth.getSession();

  if (existingSession?.user?.id && existingSession.access_token) {
    return existingSession;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session || !data.user || !data.session.access_token) {
    throw new Error('Unable to initialize Speak session.');
  }

  return data.session;
}

export function PhoneShell() {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(true);
  const teardownRef = useRef(false);

  const [state, setState] = useState<LoadState>('loading');
  const [notice, setNotice] = useState('');
  const [myUserId, setMyUserId] = useState('');
  const [myLabel, setMyLabel] = useState('');
  const [myPhone, setMyPhone] = useState('');
  const [speakContacts, setSpeakContacts] = useState<SpeakContact[]>([]);
  const [incoming, setIncoming] = useState<CallSignalPayload | null>(null);
  const [outgoing, setOutgoing] = useState<{ peerUserId: string; peerLabel: string; roomName: string } | null>(null);
  const [currentCall, setCurrentCall] = useState<ActiveCall | null>(null);

  const contactsByUserId = useMemo(() => {
    const map = new Map<string, SpeakContact>();
    for (const contact of speakContacts) {
      map.set(contact.userId, contact);
    }
    return map;
  }, [speakContacts]);

  const sendSignal = async (payload: CallSignalPayload) => {
    if (!channelRef.current) {
      return;
    }

    await channelRef.current.send({
      type: 'broadcast',
      event: 'call',
      payload,
    });
  };

  const joinRoom = async (peerUserId: string, peerLabel: string, roomName: string) => {
    teardownRef.current = false;

    const startedAtIso = new Date().toISOString();

    setCurrentCall({
      peerUserId,
      peerLabel,
      roomName,
      startedAtIso,
      phase: 'calling',
    });

    try {
      const creds = await getLiveKitToken(roomName);

      if (!mountedRef.current) return;

      setCurrentCall({
        peerUserId,
        peerLabel,
        roomName,
        startedAtIso,
        phase: 'connecting',
        token: creds.participantToken,
        serverUrl: creds.serverUrl,
      });
    } catch {
      if (!mountedRef.current) return;

      setCurrentCall({
        peerUserId,
        peerLabel,
        roomName,
        startedAtIso,
        phase: 'error',
        errorMessage: 'Unable to start call.',
      });
    }
  };

  const loadSpeakContacts = async () => {
    setState('loading');
    setNotice('');

    try {
      const session = await ensureSession();
      const localUserId = session.user.id;
      setMyUserId(localUserId);

      const permission = await Contacts.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Contacts permission denied.');
      }

      const result = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
        pageSize: 1000,
      });

      const normalizedByPhone = new Map<string, DeviceContact>();

      for (const contact of result.data) {
        const sourceName = contact.name?.trim() || 'Unknown';
        const phones = contact.phoneNumbers ?? [];

        for (const phone of phones) {
          const raw = typeof phone.number === 'string' ? phone.number : '';
          const normalized = normalizeToE164(raw);
          if (!normalized || normalizedByPhone.has(normalized)) {
            continue;
          }

          normalizedByPhone.set(normalized, {
            id: contact.id,
            name: sourceName,
            phoneE164: normalized,
          });
        }
      }

      const phoneList = [...normalizedByPhone.keys()];
      if (phoneList.length === 0) {
        setSpeakContacts([]);
        setState('ready');
        return;
      }

      const { data, error } = await supabase
        .from('user_phone_numbers')
        .select('user_id, phone_e164, is_active')
        .in('phone_e164', phoneList)
        .eq('is_active', true);

      if (error) {
        throw new Error(error.message);
      }

      const matched = (data ?? [])
        .map(item => {
          const local = normalizedByPhone.get(item.phone_e164);
          if (!local) return null;

          if (item.user_id === localUserId) {
            setMyLabel(local.name);
            setMyPhone(local.phoneE164);
            return null;
          }

          return {
            ...local,
            userId: item.user_id,
          } as SpeakContact;
        })
        .filter((item): item is SpeakContact => !!item);

      setSpeakContacts(matched);
      setState('ready');
    } catch (error) {
      setState('error');
      setNotice(error instanceof Error ? error.message : 'Unable to load contacts.');
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    void loadSpeakContacts();

    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
      }
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!myUserId) {
      return;
    }

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel('speak-contact-calls');
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'call' }, async ({ payload }) => {
        if (!mountedRef.current || !payload || typeof payload !== 'object') {
          return;
        }

        const data = payload as Partial<CallSignalPayload>;

        if (!data.type || !data.fromUserId || !data.toUserId || !data.roomName) {
          return;
        }

        if (data.toUserId !== myUserId) {
          return;
        }

        if (data.type === 'invite') {
          setIncoming({
            type: 'invite',
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
            roomName: data.roomName,
            fromName: data.fromName,
            fromPhone: data.fromPhone,
          });
          setNotice('Incoming call');
          return;
        }

        if (data.type === 'accepted') {
          setOutgoing(current => {
            if (!current || current.peerUserId !== data.fromUserId || current.roomName !== data.roomName) {
              return current;
            }

            void joinRoom(current.peerUserId, current.peerLabel, current.roomName);
            return null;
          });
          return;
        }

        if (data.type === 'declined') {
          setOutgoing(current => {
            if (!current || current.peerUserId !== data.fromUserId || current.roomName !== data.roomName) {
              return current;
            }
            setNotice('Call declined.');
            return null;
          });
          return;
        }

        if (data.type === 'ended') {
          teardownCall('Call ended.');
        }
      })
      .subscribe();
  }, [myUserId]);

  const startCall = async (contact: SpeakContact) => {
    if (!myUserId) {
      return;
    }

    teardownRef.current = false;

    const roomName = `speak-${[myUserId, contact.userId].sort().join('-')}`;
    setNotice('Calling...');
    setOutgoing({ peerUserId: contact.userId, peerLabel: contact.name, roomName });

    await sendSignal({
      type: 'invite',
      fromUserId: myUserId,
      toUserId: contact.userId,
      roomName,
      fromName: myLabel,
      fromPhone: myPhone,
    });
  };

  const teardownCall = (message: string) => {
    if (teardownRef.current) {
      return;
    }

    teardownRef.current = true;
    setCurrentCall(null);
    setOutgoing(null);
    setIncoming(null);
    setNotice(message);
    void AudioSession.stopAudioSession().catch(() => {});
  };

  const onFinishCall = (
    peerUserId: string,
    roomName: string,
    result: 'completed' | 'failed' | 'canceled'
  ) => {
    teardownCall(result === 'failed' ? 'Connection failed.' : 'Call ended.');

    void sendSignal({
      type: 'ended',
      fromUserId: myUserId,
      toUserId: peerUserId,
      roomName,
    });
  };

  if (currentCall) {
    return (
      <InCallScreen
        label={currentCall.peerLabel}
        code={currentCall.peerUserId}
        serverUrl={currentCall.serverUrl}
        token={currentCall.token}
        phase={currentCall.phase}
        errorMessage={currentCall.errorMessage}
        startedAtIso={currentCall.startedAtIso}
        onFinish={result => {
          onFinishCall(currentCall.peerUserId, currentCall.roomName, result);
        }}
      />
    );
  }

  if (incoming) {
    const fromContact = contactsByUserId.get(incoming.fromUserId);
    const fromLabel = fromContact?.name || incoming.fromName || incoming.fromPhone || 'Speak user';

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>Speak</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.title}>Incoming Call</Text>
          <Text style={styles.subtitle}>From {fromLabel}</Text>
          <TouchableOpacity
            style={styles.callButton}
            onPress={async () => {
              const payload = incoming;
              setIncoming(null);
              await sendSignal({
                type: 'accepted',
                fromUserId: myUserId,
                toUserId: payload.fromUserId,
                roomName: payload.roomName,
              });
              await joinRoom(payload.fromUserId, fromLabel, payload.roomName);
            }}
          >
            <Text style={styles.callButtonText}>Answer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.endButton}
            onPress={async () => {
              const payload = incoming;
              setIncoming(null);
              await sendSignal({
                type: 'declined',
                fromUserId: myUserId,
                toUserId: payload.fromUserId,
                roomName: payload.roomName,
              });
              setNotice('Call declined.');
            }}
          >
            <Text style={styles.endButtonText}>Decline</Text>
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
        <View style={styles.center}>
          <Text style={styles.title}>Calling {outgoing.peerLabel}</Text>
          <Text style={styles.subtitle}>Waiting for answer...</Text>
          <TouchableOpacity
            style={styles.endButton}
            onPress={async () => {
              const pending = outgoing;
              setOutgoing(null);
              await sendSignal({
                type: 'declined',
                fromUserId: myUserId,
                toUserId: pending.peerUserId,
                roomName: pending.roomName,
              });
              setNotice('Call canceled.');
            }}
          >
            <Text style={styles.endButtonText}>End</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>Speak</Text>
      </View>

      {state === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1a1a2e" />
          <Text style={styles.subtitle}>Loading contacts...</Text>
        </View>
      ) : null}

      {state === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.error}>{notice || 'Unable to load contacts.'}</Text>
          <TouchableOpacity style={styles.reloadButton} onPress={() => void loadSpeakContacts()}>
            <Text style={styles.reloadText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {state === 'ready' ? (
        <View style={styles.content}>
          <Text style={styles.title}>Speak Contacts</Text>
          {notice ? <Text style={styles.subtitle}>{notice}</Text> : null}
          <ScrollView contentContainerStyle={styles.listWrap}>
            {speakContacts.map(contact => (
              <TouchableOpacity
                key={`${contact.userId}-${contact.phoneE164}`}
                style={styles.row}
                onPress={() => {
                  void startCall(contact);
                }}
              >
                <View>
                  <Text style={styles.name}>{contact.name}</Text>
                  <Text style={styles.phone}>{contact.phoneE164}</Text>
                </View>
                <Text style={styles.badge}>Call</Text>
              </TouchableOpacity>
            ))}
            {speakContacts.length === 0 ? <Text style={styles.empty}>No registered Speak contacts yet.</Text> : null}
          </ScrollView>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 12,
    color: '#475569',
    textAlign: 'center',
  },
  error: {
    color: '#b42318',
    textAlign: 'center',
    marginBottom: 10,
  },
  reloadButton: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reloadText: {
    color: '#fff',
    fontWeight: '700',
  },
  listWrap: {
    paddingBottom: 30,
    paddingTop: 8,
  },
  row: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  phone: {
    color: '#475569',
    marginTop: 2,
  },
  badge: {
    color: '#0f8f4e',
    fontWeight: '700',
  },
  callButton: {
    width: 180,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#0f8f4e',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  callButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  endButton: {
    width: 180,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: '#b42318',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 30,
  },
});
