import * as Contacts from 'expo-contacts';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

type LoadState = 'loading' | 'ready' | 'error';

type DeviceContact = {
  id: string;
  name: string;
  phoneE164: string;
};

type SpeakContact = DeviceContact & {
  userId: string;
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
  const [state, setState] = useState<LoadState>('loading');
  const [notice, setNotice] = useState('');
  const [myUserId, setMyUserId] = useState('');
  const [speakContacts, setSpeakContacts] = useState<SpeakContact[]>([]);

  const loadSpeakContacts = async () => {
    setState('loading');
    setNotice('');

    try {
      const session = await ensureSession();
      setMyUserId(session.user.id);

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
          if (!local) {
            return null;
          }

          return {
            ...local,
            userId: item.user_id,
          } as SpeakContact;
        })
        .filter((item): item is SpeakContact => !!item)
        .filter(item => item.userId !== session.user.id);

      setSpeakContacts(matched);
      setState('ready');
    } catch (error) {
      setState('error');
      setNotice(error instanceof Error ? error.message : 'Unable to load contacts.');
    }
  };

  useEffect(() => {
    void loadSpeakContacts();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>Speak</Text>
      </View>

      {state === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color="#1a1a2e" />
          <Text style={styles.status}>Loading contacts...</Text>
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
          <Text style={styles.subtitle}>Found {speakContacts.length} registered contacts</Text>
          <ScrollView contentContainerStyle={styles.listWrap}>
            {speakContacts.map(contact => (
              <View key={`${contact.userId}-${contact.phoneE164}`} style={styles.row}>
                <View>
                  <Text style={styles.name}>{contact.name}</Text>
                  <Text style={styles.phone}>{contact.phoneE164}</Text>
                </View>
                <Text style={styles.badge}>Speak</Text>
              </View>
            ))}
            {speakContacts.length === 0 ? <Text style={styles.empty}>No registered Speak contacts yet.</Text> : null}
          </ScrollView>
          <Text style={styles.me}>Session: {myUserId}</Text>
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
  status: {
    marginTop: 12,
    color: '#475569',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    color: '#475569',
  },
  listWrap: {
    paddingBottom: 30,
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
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 30,
  },
  me: {
    marginTop: 8,
    color: '#94a3b8',
    fontSize: 12,
  },
});
