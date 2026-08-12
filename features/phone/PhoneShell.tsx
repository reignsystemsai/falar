import { Contact } from 'expo-contacts';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmptyState } from './components/EmptyState';
import { PhoneTabs } from './PhoneTabs';
import { KeypadScreen } from './screens/KeypadScreen';
import { PhoneTabKey } from './phoneTypes';
import { placePhoneCall } from './phoneCall';
import { supabase } from '../../lib/supabase';

type ContactPhoneShape = {
  number?: string | null;
  label?: string | null;
};

type ContactNumberOption = {
  rawNumber: string;
  displayNumber: string;
  label?: string;
};

type SpeakContact = {
  id: string;
  name: string;
  number: ContactNumberOption;
  favorite: boolean;
};

export function PhoneShell() {
  const [activeTab, setActiveTab] = useState<PhoneTabKey>('contacts');
  const [keypadCode, setKeypadCode] = useState('');
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<SpeakContact[]>([]);
  const [loadingContactPicker, setLoadingContactPicker] = useState(false);
  const [notice, setNotice] = useState('');

  const activeTabName = activeTab as string;

  const getUserId = async (): Promise<string | null> => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (currentSession?.user?.id) {
      return currentSession.user.id;
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user?.id) {
      console.warn('Supabase auth unavailable for phone persistence.', error?.message);
      return null;
    }

    return data.user.id;
  };

  const saveSelectedContact = async (contactName: string, numbers: string[]) => {
    try {
      const userId = await getUserId();
      if (!userId) return;

      const uniqueNumbers = [...new Set(numbers.filter(Boolean))];

      const { error } = await supabase.from('saved_contacts').insert({
        user_id: userId,
        display_name: contactName,
        phone_numbers: uniqueNumbers,
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn('Unable to persist selected contact.', error);
      setNotice('Could not save contact. Calling is still available.');
    }
  };

  const logCallRequest = async (phoneNumber: string, contactName?: string) => {
    try {
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await supabase.from('call_sessions').insert({
        user_id: userId,
        contact_name: contactName || null,
        phone_number: phoneNumber,
        status: 'requested',
        requested_at: new Date().toISOString(),
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.warn('Unable to log call request.', error);
    }
  };

  const placeSharedPhoneCall = async (rawNumber: string, contactName?: string) => {
    setNotice('');
    void logCallRequest(rawNumber, contactName);

    try {
      await placePhoneCall(rawNumber);
    } catch (error) {
      Alert.alert(
        'Unable to call',
        error instanceof Error ? error.message : 'The phone call could not be started.'
      );
    }
  };

  const normalizeContactNumber = (value: string): string | null => {
    const cleaned = value.trim();
    if (!cleaned) return null;

    const digits = cleaned.replace(/\D/g, '');
    if (!digits) return null;

    if (cleaned.startsWith('+')) {
      return `+${digits}`;
    }

    return digits;
  };

  const extractNumbers = (numbers: ContactPhoneShape[]): ContactNumberOption[] => {
    const dedup = new Set<string>();
    const options: ContactNumberOption[] = [];

    for (const item of numbers) {
      const raw = typeof item.number === 'string' ? item.number : '';
      const normalized = normalizeContactNumber(raw);

      if (!normalized || dedup.has(normalized)) {
        continue;
      }

      dedup.add(normalized);
      options.push({
        rawNumber: normalized,
        displayNumber: raw || normalized,
        label: item.label || 'Phone',
      });
    }

    return options;
  };

  const applyChosenNumber = (contactId: string, name: string, option: ContactNumberOption) => {
    setContacts(current => {
      const withoutSameNumber = current.filter(
        item => !(item.id === contactId && item.number.rawNumber === option.rawNumber)
      );
      const existingFavorite = current.find(item => item.id === contactId)?.favorite ?? false;

      return [{ id: contactId, name, number: option, favorite: existingFavorite }, ...withoutSameNumber];
    });

    void saveSelectedContact(name, [option.rawNumber]);
  };

  const openContactPicker = async () => {
    setNotice('');
    setLoadingContactPicker(true);

    try {
      const picked = await Contact.presentPicker();

      if (!picked) {
        return;
      }

      const [displayName, phones] = await Promise.all([picked.getFullName(), picked.getPhones()]);

      const options = extractNumbers((phones as ContactPhoneShape[]) ?? []);
      const contactName = (displayName || '').trim() || 'Unknown Contact';

      if (options.length === 0) {
        Alert.alert('No phone number', 'This contact has no phone number.');
        return;
      }

      if (options.length === 1) {
        applyChosenNumber(picked.id, contactName, options[0]);
        return;
      }

      Alert.alert(
        contactName,
        'Which number do you want to use?',
        [
          ...options.map(option => ({
            text: `${option.label || 'Phone'} ${option.displayNumber}`,
            onPress: () => applyChosenNumber(picked.id, contactName, option),
          })),
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } catch (error) {
      console.warn('Contact picker failed.', error);
      Alert.alert('Contacts unavailable', 'Speak could not open your contacts.');
    } finally {
      setLoadingContactPicker(false);
    }
  };

  const filteredContacts = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) {
      return contacts;
    }

    return contacts.filter(
      contact =>
        contact.name.toLowerCase().includes(value) ||
        contact.number.displayNumber.toLowerCase().includes(value)
    );
  }, [contacts, query]);

  const favoriteContacts = filteredContacts.filter(item => item.favorite);
  const allContacts = filteredContacts;

  const toggleFavorite = (contact: SpeakContact) => {
    setContacts(current =>
      current.map(item => {
        if (item.id === contact.id && item.number.rawNumber === contact.number.rawNumber) {
          return { ...item, favorite: !item.favorite };
        }

        return item;
      })
    );
  };

  const renderContactRow = (contact: SpeakContact) => (
    <View key={`${contact.id}-${contact.number.rawNumber}`} style={styles.contactRow}>
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarText}>{initials(contact.name)}</Text>
      </View>

      <View style={styles.contactTextWrap}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactMeta}>
          {contact.number.label || 'Phone'} {'\u2022'} {contact.number.displayNumber}
        </Text>
      </View>

      <TouchableOpacity style={styles.favoriteButton} onPress={() => toggleFavorite(contact)}>
        <Text style={styles.favoriteButtonText}>{contact.favorite ? '\u2605' : '\u2606'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.callButton}
        onPress={() => void placeSharedPhoneCall(contact.number.rawNumber, contact.name)}
      >
        <Text style={styles.callButtonText}>Call</Text>
      </TouchableOpacity>
    </View>
  );

  const contactsView = (
    <View style={styles.panel}>
      <View style={styles.headerWrap}>
        <View>
          <Text style={styles.wordmark}>Speak</Text>
          <Text style={styles.subtitle}>Choose a contact to call</Text>
        </View>
        <View style={styles.profileStub}>
          <Text style={styles.profileStubText}>A</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search contacts"
          placeholderTextColor="#8792a2"
          style={styles.searchInput}
        />
      </View>

      <TouchableOpacity style={styles.pickButton} onPress={() => void openContactPicker()} disabled={loadingContactPicker}>
        <Text style={styles.pickButtonText}>
          {loadingContactPicker ? 'Opening Contacts...' : 'Add from iPhone Contacts'}
        </Text>
      </TouchableOpacity>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <Text style={styles.sectionTitle}>★ Favorites</Text>
        {favoriteContacts.length ? (
          favoriteContacts.map(renderContactRow)
        ) : (
          <Text style={styles.emptySectionText}>No favorites yet.</Text>
        )}

        <Text style={styles.sectionTitle}>All Contacts</Text>
        {allContacts.length ? (
          allContacts.map(renderContactRow)
        ) : (
          <Text style={styles.emptySectionText}>No Speak contacts yet.</Text>
        )}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </ScrollView>
    </View>
  );

  const favoritesOnlyView = (
    <View style={styles.panel}>
      <Text style={styles.wordmark}>Speak</Text>
      <Text style={styles.subtitle}>Favorite contacts</Text>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {favoriteContacts.length ? favoriteContacts.map(renderContactRow) : <Text style={styles.emptySectionText}>No favorites yet.</Text>}
      </ScrollView>
    </View>
  );

  const recentsView = (
    <EmptyState title="No recents yet" message="Place a call from Contacts or Keypad to see recents later." />
  );

  const keypadView = (
    <KeypadScreen
      code={keypadCode}
      onChangeCode={setKeypadCode}
      onCall={number => {
        void placeSharedPhoneCall(number);
      }}
    />
  );

  const content =
    activeTabName === 'favorites'
      ? favoritesOnlyView
      : activeTabName === 'recents'
        ? recentsView
        : activeTabName === 'keypad'
          ? keypadView
          : contactsView;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>{content}</View>
      <PhoneTabs activeTab={activeTab} onChange={setActiveTab} />
    </SafeAreaView>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  content: {
    flex: 1,
  },
  panel: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontSize: 36,
    fontWeight: '800',
    color: '#102347',
  },
  subtitle: {
    marginTop: 2,
    color: '#52607a',
    fontSize: 16,
  },
  profileStub: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#102347',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileStubText: {
    color: '#fff',
    fontWeight: '700',
  },
  searchWrap: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4dae3',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  searchInput: {
    height: 44,
    color: '#102347',
    fontSize: 15,
  },
  pickButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#132033',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  list: {
    flex: 1,
    marginTop: 14,
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionTitle: {
    color: '#102347',
    fontWeight: '700',
    fontSize: 17,
    marginTop: 10,
    marginBottom: 8,
  },
  emptySectionText: {
    color: '#7a8699',
    marginBottom: 8,
  },
  contactRow: {
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e5ec',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 10,
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#dbe6f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#102347',
    fontWeight: '700',
  },
  contactTextWrap: {
    flex: 1,
  },
  contactName: {
    color: '#102347',
    fontSize: 16,
    fontWeight: '700',
  },
  contactMeta: {
    marginTop: 3,
    color: '#6d7b90',
    fontSize: 13,
  },
  favoriteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f3f8',
  },
  favoriteButtonText: {
    color: '#102347',
    fontSize: 18,
  },
  callButton: {
    minWidth: 62,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#18a957',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  callButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  notice: {
    marginTop: 10,
    color: '#52607a',
  },
});
