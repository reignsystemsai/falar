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
import { SpeakPhoneTheme } from './speakPhoneTheme';
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

type PhoneView = 'home' | 'tabs' | 'contactDetail';

const { colors } = SpeakPhoneTheme;

export function PhoneShell() {
  const [activeTab, setActiveTab] = useState<PhoneTabKey>('contacts');
  const [view, setView] = useState<PhoneView>('home');
  const [keypadCode, setKeypadCode] = useState('');
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<SpeakContact[]>([]);
  const [loadingContactPicker, setLoadingContactPicker] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedContact, setSelectedContact] = useState<SpeakContact | null>(null);

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
    const nextContact: SpeakContact = {
      id: contactId,
      name,
      number: option,
      favorite: contacts.find(item => item.id === contactId)?.favorite ?? false,
    };

    setContacts(current => {
      const withoutSameNumber = current.filter(
        item => !(item.id === contactId && item.number.rawNumber === option.rawNumber)
      );

      return [nextContact, ...withoutSameNumber];
    });

    setSelectedContact(nextContact);
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
        setView('contactDetail');
        return;
      }

      Alert.alert(
        contactName,
        'Which number do you want to use?',
        [
          ...options.map(option => ({
            text: `${option.label || 'Phone'} ${option.displayNumber}`,
            onPress: () => {
              applyChosenNumber(picked.id, contactName, option);
              setView('contactDetail');
            },
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

  const openContactDetail = (contact: SpeakContact) => {
    setSelectedContact(contact);
    setView('contactDetail');
  };

  const renderContactRow = (contact: SpeakContact) => (
    <TouchableOpacity
      key={`${contact.id}-${contact.number.rawNumber}`}
      style={styles.contactRow}
      onPress={() => openContactDetail(contact)}
    >
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarText}>{initials(contact.name)}</Text>
      </View>

      <View style={styles.contactTextWrap}>
        <Text style={styles.contactName}>{contact.name}</Text>
        <Text style={styles.contactMeta}>{contact.number.displayNumber}</Text>
      </View>

      <TouchableOpacity style={styles.favoriteButton} onPress={() => toggleFavorite(contact)}>
        <Text style={styles.favoriteButtonText}>{contact.favorite ? '★' : '☆'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.contactCallIconButton}
        onPress={() => void placeSharedPhoneCall(contact.number.rawNumber, contact.name)}
      >
        <Text style={styles.contactCallIcon}>☎</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const homeView = (
    <View style={styles.homePanel}>
      <Text style={styles.homeLogo}>S</Text>
      <Text style={styles.homeTitle}>Speak</Text>
      <Text style={styles.homeTagline}>The world speaks here.</Text>

      <View style={styles.readyRing}>
        <View style={styles.readyRingInner}>
          <Text style={styles.wave}>▂▅▇▅▂</Text>
          <Text style={styles.readyText}>Ready</Text>
        </View>
      </View>

      <Text style={styles.languagesTitle}>Speak languages</Text>
      <View style={styles.languageRow}>
        <Text style={styles.languageText}>English</Text>
      </View>
      <View style={styles.languageRow}>
        <Text style={styles.languageText}>Spanish</Text>
      </View>

      <TouchableOpacity
        style={styles.speakNowButton}
        onPress={() => {
          setActiveTab('contacts');
          setView('tabs');
        }}
      >
        <Text style={styles.speakNowText}>Speak Now</Text>
      </TouchableOpacity>
    </View>
  );

  const contactsView = (
    <View style={styles.panel}>
      <View style={styles.contactsTopRow}>
        <Text style={styles.brandCompact}>S Speak</Text>
      </View>

      <Text style={styles.contactsTitle}>Contacts</Text>
      <Text style={styles.contactsSubtitle}>Find someone and start a call.</Text>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search contacts"
          placeholderTextColor={colors.secondary}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.segment}>
        <View style={styles.segmentActive}>
          <Text style={styles.segmentActiveText}>Contacts</Text>
        </View>
        <View style={styles.segmentInactive}>
          <Text style={styles.segmentInactiveText}>Recents</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.pickButton} onPress={() => void openContactPicker()} disabled={loadingContactPicker}>
        <Text style={styles.pickButtonText}>{loadingContactPicker ? 'Opening Contacts...' : 'Add from iPhone Contacts'}</Text>
      </TouchableOpacity>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filteredContacts.length ? filteredContacts.map(renderContactRow) : <Text style={styles.emptySectionText}>No Speak contacts yet.</Text>}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </ScrollView>
    </View>
  );

  const contactDetailView = selectedContact ? (
    <View style={styles.panel}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => {
          setView('tabs');
          setActiveTab('contacts');
        }}
      >
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>

      <Text style={styles.detailEyebrow}>CONTACT DETAIL</Text>
      <Text style={styles.detailTitle}>Ready to Call.</Text>
      <Text style={styles.detailSubtitle}>Tap the button below to start a voice call immediately.</Text>

      <View style={styles.detailCard}>
        <View style={styles.detailAvatarWrap}>
          <Text style={styles.detailAvatarText}>{initials(selectedContact.name)}</Text>
        </View>
        <Text style={styles.detailName}>{selectedContact.name}</Text>
        <Text style={styles.detailNumber}>{selectedContact.number.displayNumber}</Text>
        <Text style={styles.detailLabel}>{selectedContact.number.label || 'Phone'}</Text>
      </View>

      <TouchableOpacity
        style={styles.callOrbOuter}
        onPress={() => void placeSharedPhoneCall(selectedContact.number.rawNumber, selectedContact.name)}
      >
        <View style={styles.callOrbInner}>
          <Text style={styles.callOrbIcon}>☎</Text>
        </View>
      </TouchableOpacity>
    </View>
  ) : (
    <EmptyState title="No contact selected" message="Choose a contact to start a call." />
  );

  const favoritesView = (
    <View style={styles.panel}>
      <Text style={styles.brandCompact}>S Speak</Text>
      <Text style={styles.contactsTitle}>Favorites</Text>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {favoriteContacts.length ? favoriteContacts.map(renderContactRow) : <Text style={styles.emptySectionText}>No favorites yet.</Text>}
      </ScrollView>
    </View>
  );

  const recentsView = <EmptyState title="No recents yet" message="No recents yet" />;

  const keypadView = (
    <KeypadScreen
      code={keypadCode}
      onChangeCode={setKeypadCode}
      onCall={number => {
        void placeSharedPhoneCall(number);
      }}
    />
  );

  let content = contactsView;
  if (activeTab === 'favorites') {
    content = favoritesView;
  } else if (activeTab === 'recents') {
    content = recentsView;
  } else if (activeTab === 'keypad') {
    content = keypadView;
  }

  if (view === 'home') {
    return (
      <SafeAreaView style={styles.safe}>
        {homeView}
      </SafeAreaView>
    );
  }

  if (view === 'contactDetail') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>{contactDetailView}</View>
      </SafeAreaView>
    );
  }

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
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  panel: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: colors.background,
  },
  homePanel: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    backgroundColor: colors.background,
  },
  homeLogo: {
    color: colors.cyan,
    fontSize: 58,
    fontWeight: '300',
    textAlign: 'center',
  },
  homeTitle: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 36,
    fontWeight: '800',
    marginTop: -8,
  },
  homeTagline: {
    color: colors.secondary,
    textAlign: 'center',
    marginTop: 2,
  },
  readyRing: {
    alignSelf: 'center',
    width: 228,
    height: 228,
    borderRadius: 114,
    borderWidth: 1,
    borderColor: colors.blueDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  readyRingInner: {
    width: 158,
    height: 158,
    borderRadius: 79,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.blue,
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  wave: {
    color: colors.cyan,
    fontSize: 34,
  },
  readyText: {
    color: colors.text,
    marginTop: 8,
    fontWeight: '700',
  },
  languagesTitle: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: 8,
  },
  languageRow: {
    minHeight: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  languageText: {
    color: colors.text,
    fontSize: 16,
  },
  speakNowButton: {
    marginTop: 6,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cyan,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakNowText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  contactsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandCompact: {
    color: colors.cyan,
    fontSize: 24,
    fontWeight: '700',
  },
  contactsTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    marginTop: 10,
  },
  contactsSubtitle: {
    color: colors.secondary,
    marginTop: 2,
    marginBottom: 14,
  },
  searchWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
  },
  searchInput: {
    height: 44,
    color: colors.text,
    fontSize: 15,
  },
  segment: {
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  segmentActive: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blueDeep,
  },
  segmentInactive: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActiveText: {
    color: colors.text,
    fontWeight: '700',
  },
  segmentInactiveText: {
    color: colors.secondary,
    fontWeight: '600',
  },
  pickButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButtonText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  list: {
    flex: 1,
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 24,
  },
  contactRow: {
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 10,
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.cyan,
    fontWeight: '700',
  },
  contactTextWrap: {
    flex: 1,
  },
  contactName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  contactMeta: {
    marginTop: 3,
    color: colors.secondary,
    fontSize: 13,
  },
  favoriteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
  },
  favoriteButtonText: {
    color: colors.text,
    fontSize: 18,
  },
  contactCallIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
  },
  contactCallIcon: {
    color: colors.blue,
    fontSize: 20,
  },
  detailEyebrow: {
    color: colors.cyan,
    fontWeight: '700',
    fontSize: 11,
    marginTop: 12,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 5,
  },
  detailSubtitle: {
    marginTop: 6,
    color: colors.secondary,
    maxWidth: 280,
    lineHeight: 20,
  },
  detailCard: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 22,
    alignItems: 'center',
  },
  detailAvatarWrap: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailAvatarText: {
    color: colors.cyan,
    fontSize: 30,
    fontWeight: '700',
  },
  detailName: {
    marginTop: 14,
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  detailNumber: {
    marginTop: 6,
    color: colors.secondary,
    fontSize: 15,
  },
  detailLabel: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 13,
  },
  callOrbOuter: {
    alignSelf: 'center',
    marginTop: 24,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: colors.blueDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callOrbInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.blue,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  callOrbIcon: {
    color: colors.text,
    fontSize: 36,
  },
  backButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.secondary,
    fontWeight: '700',
  },
  emptySectionText: {
    color: colors.secondary,
    marginTop: 6,
  },
  notice: {
    marginTop: 10,
    color: colors.secondary,
  },
});
