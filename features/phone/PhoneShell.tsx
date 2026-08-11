import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AudioSession } from '@livekit/react-native';
import { supabase } from '../../lib/supabase';
import { getLiveKitToken } from '../../lib/livekit';
import { PhoneTabs } from './PhoneTabs';
import { addContact, addRecentCall, loadContacts, loadRecents, toggleFavorite } from './phoneStorage';
import { Contact, PhoneTabKey, RecentCall } from './phoneTypes';
import { ContactsScreen } from './screens/ContactsScreen';
import { FavoritesScreen } from './screens/FavoritesScreen';
import { InCallScreen } from './screens/InCallScreen';
import { KeypadScreen } from './screens/KeypadScreen';
import { RecentsScreen } from './screens/RecentsScreen';

function normalizeVisibleCode(value: string): string {
  return value.replace(/[^\d*#]/g, '');
}

export function PhoneShell() {
  const [activeTab, setActiveTab] = useState<PhoneTabKey>('keypad');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recents, setRecents] = useState<RecentCall[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');

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

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const [savedContacts, savedRecents] = await Promise.all([loadContacts(), loadRecents()]);

      if (!mounted) return;

      setContacts(savedContacts);
      setRecents(savedRecents);
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const contactsByNumber = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach(contact => {
      map.set(contact.number.replace(/\D/g, ''), contact);
    });
    return map;
  }, [contacts]);

  const saveContact = async () => {
    const normalized = contactNumber.replace(/\D/g, '');
    if (!contactName.trim() || normalized.length < 3) {
      return;
    }

    const updated = await addContact(contactName, normalized);
    setContacts(updated);
    setContactName('');
    setContactNumber('');
  };

  const handleToggleFavorite = async (contactId: string) => {
    const updated = await toggleFavorite(contactId);
    setContacts(updated);
  };

  const placeFromList = (number: string) => {
    const numeric = number.replace(/\D/g, '');
    setCode(numeric);
    setActiveTab('keypad');
  };

  const startCall = async (numericCode: string) => {
    if (numericCode.length < 3) {
      return;
    }

    setNotice('');

    const knownContact = contactsByNumber.get(numericCode);
    const startedAtIso = new Date().toISOString();
    const roomName = `speak-${numericCode}`;

    setCurrentCall({
      code: numericCode,
      roomName,
      label: knownContact?.name ?? `Code ${numericCode}`,
      phase: 'calling',
      startedAtIso,
    });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setCurrentCall({
        code: numericCode,
        roomName,
        label: knownContact?.name ?? `Code ${numericCode}`,
        phase: 'error',
        startedAtIso,
        errorMessage: 'Please sign in.',
      });
      await supabase.auth.signOut();
      return;
    }

    try {
      const token = await getLiveKitToken(roomName);
      await AudioSession.startAudioSession();

      setCurrentCall({
        code: numericCode,
        roomName,
        label: knownContact?.name ?? `Code ${numericCode}`,
        phase: 'connecting',
        startedAtIso,
        serverUrl: token.serverUrl,
        token: token.participantToken,
      });
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message =
        rawMessage.includes('Supabase session missing')
          ? 'Please sign in.'
          : rawMessage.includes('Unable to')
          ? 'Unable to start call.'
          : 'Connection failed.';

      setCurrentCall({
        code: numericCode,
        roomName,
        label: knownContact?.name ?? `Code ${numericCode}`,
        phase: 'error',
        startedAtIso,
        errorMessage: message,
      });
    }
  };

  const finishCall = async (
    number: string,
    startedAtIso: string,
    durationSeconds: number,
    result: 'completed' | 'failed' | 'canceled'
  ) => {
    const knownContact = contactsByNumber.get(number);
    const updatedRecents = await addRecentCall({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      number,
      contactName: knownContact?.name,
      startedAt: startedAtIso,
      endedAt: new Date().toISOString(),
      durationSeconds,
      result,
    });

    setRecents(updatedRecents);
    setCurrentCall(null);

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

  const renderScreen = () => {
    if (activeTab === 'favorites') {
      return <FavoritesScreen contacts={contacts} onCall={startCall} />;
    }

    if (activeTab === 'recents') {
      return <RecentsScreen recents={recents} onRedial={startCall} />;
    }

    if (activeTab === 'contacts') {
      return (
        <ContactsScreen
          contacts={contacts}
          contactName={contactName}
          contactNumber={contactNumber}
          onChangeContactName={setContactName}
          onChangeContactNumber={value => setContactNumber(value.replace(/[^\d*#]/g, ''))}
          onSaveContact={saveContact}
          onToggleFavorite={handleToggleFavorite}
          onCall={placeFromList}
        />
      );
    }

    return (
      <KeypadScreen
        code={code}
        onChangeCode={value => setCode(normalizeVisibleCode(value))}
        onCall={startCall}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>Speak</Text>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {notice ? (
        <View style={styles.noticeWrap}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.content}>{renderScreen()}</View>

      <PhoneTabs activeTab={activeTab} onChange={setActiveTab} />
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
  signOut: {
    color: '#666',
    fontWeight: '600',
  },
  content: {
    flex: 1,
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
});
