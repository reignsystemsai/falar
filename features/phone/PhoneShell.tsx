import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { PhoneTabs } from './PhoneTabs';
import { addContact, addRecentCall, loadContacts, loadRecents, toggleFavorite } from './phoneStorage';
import { Contact, PhoneTabKey, RecentCall } from './phoneTypes';
import { ContactsScreen } from './screens/ContactsScreen';
import { FavoritesScreen } from './screens/FavoritesScreen';
import { KeypadScreen } from './screens/KeypadScreen';
import { RecentsScreen } from './screens/RecentsScreen';

function normalizeVisibleCode(value: string): string {
  return value.replace(/[^\d*#]/g, '');
}

export function PhoneShell() {
  const [activeTab, setActiveTab] = useState<PhoneTabKey>('keypad');
  const [code, setCode] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recents, setRecents] = useState<RecentCall[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');

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

  const callFromKeypad = async (numericCode: string) => {
    const started = new Date();
    const ended = new Date();
    const knownContact = contactsByNumber.get(numericCode);

    const updatedRecents = await addRecentCall({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      number: numericCode,
      contactName: knownContact?.name,
      startedAt: started.toISOString(),
      endedAt: ended.toISOString(),
      durationSeconds: 0,
      result: 'canceled',
    });

    setRecents(updatedRecents);
  };

  const renderScreen = () => {
    if (activeTab === 'favorites') {
      return <FavoritesScreen contacts={contacts} onCall={placeFromList} />;
    }

    if (activeTab === 'recents') {
      return <RecentsScreen recents={recents} onRedial={placeFromList} />;
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
        onCall={callFromKeypad}
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
});
