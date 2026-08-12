import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { FavoritesScreen } from './screens/FavoritesScreen';
import { KeypadScreen } from './screens/KeypadScreen';
import { RecentsScreen } from './screens/RecentsScreen';
import { OutgoingCallScreen } from './screens/OutgoingCallScreen';
import { IncomingCallScreen } from './screens/IncomingCallScreen';
import { ActiveCallScreen } from './screens/ActiveCallScreen';
import { SpeakPhoneTheme } from './speakPhoneTheme';
import { supabase } from '../../lib/supabase';
import { useSpeakCall } from './calls/SpeakCallProvider';
import { cleanContactLabel, normalizeSpeakNumber } from './calls/phoneFormatting';
import { ensureSpeakDiscoveryProfile, hasCompleteSpeakDiscoveryProfile } from '../auth/ensureSpeakDiscoveryProfile';

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
  sourceContactId?: string;
  favorite: boolean;
};

type SavedContactRow = {
  id: string;
  display_name: string;
  phone_numbers: string[] | null;
  normalized_phone_numbers: string[] | null;
  source_contact_id: string | null;
};

type ContactImportRow = {
  sourceContactId: string;
  displayName: string;
  phoneNumbers: string[];
  normalizedPhoneNumbers: string[];
};

type PhoneScreen =
  | 'home'
  | 'favorites'
  | 'recents'
  | 'contacts'
  | 'detail'
  | 'keypad'
  | 'profile';

const { colors, radius } = SpeakPhoneTheme;

export function PhoneShell() {
  const {
    phase,
    currentCall,
    muted,
    callMinimized,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    minimizeCall,
    restoreCall,
  } = useSpeakCall();

  const [stack, setStack] = useState<PhoneScreen[]>(['home']);
  const [keypadCode, setKeypadCode] = useState('');
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<SpeakContact[]>([]);
  const [recents] = useState<
    Array<{
      id: string;
      number: string;
      contactName?: string;
      startedAt: string;
      endedAt: string;
      durationSeconds: number;
      result: 'completed' | 'failed' | 'canceled';
    }>
  >([]);
  const [loadingContactPicker, setLoadingContactPicker] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedContact, setSelectedContact] = useState<SpeakContact | null>(null);

  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [didLoadProfile, setDidLoadProfile] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [registrationName, setRegistrationName] = useState('');
  const [registrationPhone, setRegistrationPhone] = useState('');
  const [registrationError, setRegistrationError] = useState('');

  const [activeDuration, setActiveDuration] = useState(0);
  const activeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const didShowMediaDeniedRef = useRef(false);
  const didShowContactsDeniedRef = useRef(false);
  const screen = stack[stack.length - 1] || 'home';

  useEffect(() => {
    if (phase === 'active') {
      if (!activeTimerRef.current) {
        activeTimerRef.current = setInterval(() => {
          setActiveDuration(value => value + 1);
        }, 1000);
      }
    } else {
      if (activeTimerRef.current) {
        clearInterval(activeTimerRef.current);
        activeTimerRef.current = null;
      }
      setActiveDuration(0);
    }

    return () => {
      if (activeTimerRef.current) {
        clearInterval(activeTimerRef.current);
        activeTimerRef.current = null;
      }
    };
  }, [phase]);

  const pushScreen = (next: PhoneScreen) => {
    setStack(current => [...current, next]);
  };

  const goBack = () => {
    setStack(current => (current.length > 1 ? current.slice(0, -1) : ['home']));
  };

  const goHome = () => {
    setStack(['home']);
  };

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

  const loadSpeakProfile = async () => {
    const userId = await getUserId();
    if (!userId) {
      return;
    }

    const { data } = await supabase
      .from('speak_profiles')
      .select('display_name, phone_e164')
      .eq('user_id', userId)
      .maybeSingle();

    if (data?.display_name) {
      setProfileName(data.display_name);
    }
    if (data?.phone_e164) {
      setProfilePhone(data.phone_e164);
    }
  };

  useEffect(() => {
    if (screen === 'profile' && !didLoadProfile) {
      setDidLoadProfile(true);
      void loadSpeakProfile();
    }
  }, [didLoadProfile, screen]);

  const refreshRegistrationState = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const isComplete = await hasCompleteSpeakDiscoveryProfile(session);
    setNeedsRegistration(!isComplete);

    if (isComplete || !session?.user) {
      return;
    }

    const metadata = session.user.user_metadata as Record<string, unknown> | undefined;
    if (!registrationName.trim()) {
      const prefillName =
        (typeof metadata?.display_name === 'string' ? metadata.display_name : null) ||
        (typeof metadata?.full_name === 'string' ? metadata.full_name : null) ||
        (typeof metadata?.name === 'string' ? metadata.name : null) ||
        session.user.email?.split('@')[0] ||
        '';
      if (prefillName) {
        setRegistrationName(prefillName);
      }
    }

    if (!registrationPhone.trim()) {
      const prefillPhone =
        (typeof session.user.phone === 'string' ? session.user.phone : null) ||
        (typeof metadata?.phone === 'string' ? metadata.phone : null) ||
        (typeof metadata?.phone_number === 'string' ? metadata.phone_number : null) ||
        '';
      if (prefillPhone) {
        setRegistrationPhone(prefillPhone);
      }
    }
  };

  useEffect(() => {
    void refreshRegistrationState();
  }, []);

  const saveProfile = async () => {
    const userId = await getUserId();
    if (!userId) {
      Alert.alert('Unavailable', 'Could not identify the current Speak user.');
      return;
    }

    const displayName = profileName.trim();
    if (!displayName) {
      Alert.alert('Name required', 'Please enter your display name.');
      return;
    }

    const normalized = normalizeSpeakNumber(profilePhone);
    if (!normalized) {
      Alert.alert('Country code required', 'Please enter your phone number with country code.');
      return;
    }

    setSavingProfile(true);
    const { error } = await supabase.from('speak_profiles').upsert(
      {
        user_id: userId,
        display_name: displayName,
        phone_e164: normalized,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );
    setSavingProfile(false);

    if (error) {
      Alert.alert('Profile save failed', error.message);
      return;
    }

    setProfilePhone(normalized);
    Alert.alert('Saved', 'My Speak Profile updated.');
  };

  const loadContactsFromSupabase = async () => {
    const userId = await getUserId();
    if (!userId) {
      return;
    }

    const { data, error } = await supabase
      .from('saved_contacts')
      .select('id, display_name, phone_numbers, normalized_phone_numbers, source_contact_id')
      .eq('user_id', userId)
      .order('display_name', { ascending: true });

    if (error) {
      console.warn('Unable to load saved contacts from Supabase.', error);
      setNotice(error.message);
      return;
    }

    const nextContacts = mapRowsToContacts(
      ((data as SavedContactRow[] | null) ?? []).map(row => ({
        sourceContactId: row.source_contact_id || row.id,
        displayName: row.display_name || 'Unknown Contact',
        phoneNumbers: Array.isArray(row.phone_numbers) ? row.phone_numbers : [],
        normalizedPhoneNumbers: Array.isArray(row.normalized_phone_numbers) ? row.normalized_phone_numbers : [],
      }))
    );

    setContacts(nextContacts);
    setNotice('');
  };

  const mapRowsToContacts = (rows: ContactImportRow[]): SpeakContact[] => {
    const deduped = new Map<string, SpeakContact>();

    for (const row of rows) {
      const total = Math.max(row.phoneNumbers.length, row.normalizedPhoneNumbers.length);

      for (let index = 0; index < total; index += 1) {
        const readable = row.phoneNumbers[index] || row.normalizedPhoneNumbers[index] || '';
        const normalized = row.normalizedPhoneNumbers[index] || normalizeContactNumber(readable);

        if (!readable || !normalized) {
          continue;
        }

        const key = `${row.sourceContactId}:${normalized}`;
        if (deduped.has(key)) {
          continue;
        }

        deduped.set(key, {
          id: key,
          sourceContactId: row.sourceContactId,
          name: row.displayName || 'Unknown Contact',
          number: {
            rawNumber: normalized,
            displayNumber: readable,
            label: 'Mobile',
          },
          favorite: false,
        });
      }
    }

    return [...deduped.values()].sort((left, right) => left.name.localeCompare(right.name));
  };

  const mergeContacts = (primary: SpeakContact[], secondary: SpeakContact[]): SpeakContact[] => {
    const merged = new Map<string, SpeakContact>();

    for (const contact of [...secondary, ...primary]) {
      const key = `${contact.sourceContactId || contact.id}:${contact.number.rawNumber}`;
      const current = merged.get(key);
      merged.set(key, current ? { ...current, ...contact, favorite: current.favorite || contact.favorite } : contact);
    }

    return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name));
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
        label: cleanContactLabel(item.label),
      });
    }

    return options;
  };

  const applyChosenNumber = (contactId: string, name: string, option: ContactNumberOption) => {
    const nextContact: SpeakContact = {
      id: `${contactId}:${option.rawNumber}`,
      name,
      number: option,
      sourceContactId: contactId,
      favorite: contacts.find(item => item.sourceContactId === contactId)?.favorite ?? false,
    };

    setContacts(current => {
      const withoutSameNumber = current.filter(
        item => !(item.id === contactId && item.number.rawNumber === option.rawNumber)
      );

      return [nextContact, ...withoutSameNumber];
    });

    setSelectedContact(nextContact);
  };

  useEffect(() => {
    void loadContactsFromSupabase();
  }, []);

  useEffect(() => {
    if (screen === 'contacts') {
      void loadContactsFromSupabase();
    }
  }, [screen]);

  const importIphoneContacts = async (): Promise<ContactImportRow[]> => {
    const rows: ContactImportRow[] = [];
    const fields = [ContactField.FULL_NAME, ContactField.PHONES] as const;
    const limit = 75;
    let offset = 0;

    for (;;) {
      const page = await Contact.getAllDetails(fields, { limit, offset });
      if (!page.length) {
        break;
      }

      for (let index = 0; index < page.length; index += 1) {
        const entry = page[index];
        const fullName = (entry.fullName || '').trim();
        const displayName = fullName || 'Unknown Contact';
        const sourceContactId = String(entry.id || `${offset + index}`);
        const phones = Array.isArray(entry.phones) ? (entry.phones as ContactPhoneShape[]) : [];

        const uniqueReadable = [...new Set(phones.map(phone => (phone.number || '').trim()).filter(Boolean))];
        const uniqueNormalized = [
          ...new Set(phones.map(phone => normalizeContactNumber(phone.number || '')).filter(Boolean) as string[]),
        ];

        if (!uniqueReadable.length || !uniqueNormalized.length) {
          continue;
        }

        rows.push({
          sourceContactId,
          displayName,
          phoneNumbers: uniqueReadable,
          normalizedPhoneNumbers: uniqueNormalized,
        });
      }

      offset += page.length;
      if (page.length < limit) {
        break;
      }
    }

    return rows;
  };

  const openContactPicker = async () => {
    setNotice('');
    setLoadingContactPicker(true);

    try {
      const permission = await requestPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('contacts permission denied');
      }

      const rows = await importIphoneContacts();

      if (!rows.length) {
        setNotice('No accessible contacts with phone numbers were found.');
        return;
      }

      const importedContacts = mapRowsToContacts(rows);
      setContacts(current => mergeContacts(importedContacts, current));
      setNotice(`Imported ${importedContacts.length} contact${importedContacts.length === 1 ? '' : 's'} from iPhone.`);
    } catch (error) {
      console.warn('Bulk contact import failed.', error);

      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (
        (message.includes('permission') || message.includes('denied')) &&
        !didShowContactsDeniedRef.current
      ) {
        didShowContactsDeniedRef.current = true;
        setNotice('Allow contacts access in Settings so Speak can import your iPhone contacts.');
        return;
      }

      setNotice(error instanceof Error ? error.message : 'Contact import failed.');
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
    const related = contacts.filter(item => {
      if (contact.sourceContactId && item.sourceContactId) {
        return item.sourceContactId === contact.sourceContactId;
      }

      return item.name === contact.name;
    });

    const uniqueByNumber = related.filter(
      (item, index, all) =>
        all.findIndex(candidate => candidate.number.rawNumber === item.number.rawNumber) === index
    );

    if (uniqueByNumber.length > 1) {
      Alert.alert(
        contact.name,
        'Which number do you want to use?',
        [
          ...uniqueByNumber.map(option => ({
            text: `${cleanContactLabel(option.number.label)} ${option.number.displayNumber}`,
            onPress: () => {
              setSelectedContact(option);
              pushScreen('detail');
            },
          })),
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    setSelectedContact(contact);
    pushScreen('detail');
  };

  const onTabPress = (next: PhoneScreen) => {
    if (next === screen) {
      return;
    }
    pushScreen(next);
  };

  const ensureMediaPermissions = async (): Promise<boolean> => {
    const micStatus = await Camera.getMicrophonePermissionsAsync();
    const cameraStatus = await Camera.getCameraPermissionsAsync();

    let finalMic = micStatus;
    let finalCamera = cameraStatus;

    if (micStatus.status === 'undetermined') {
      finalMic = await Camera.requestMicrophonePermissionsAsync();
    }

    if (cameraStatus.status === 'undetermined') {
      finalCamera = await Camera.requestCameraPermissionsAsync();
    }

    const blocked = finalMic.status !== 'granted' || finalCamera.status !== 'granted';

    if (blocked && !didShowMediaDeniedRef.current) {
      didShowMediaDeniedRef.current = true;
      Alert.alert(
        'Permissions needed',
        'Allow camera and microphone in Settings to use Speak calling media features.'
      );
    }

    return !blocked;
  };

  const startSpeakCallFromContact = async (contact: SpeakContact) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const hasDiscoveryProfile = await hasCompleteSpeakDiscoveryProfile(session);
    if (!hasDiscoveryProfile) {
      setRegistrationError('Complete your Speak registration before calling.');
      goHome();
      return;
    }

    const normalized = normalizeSpeakNumber(contact.number.rawNumber || contact.number.displayNumber);
    if (!normalized) {
      Alert.alert('Country code required', 'Add the country code to this contact to call them on Speak.');
      return;
    }

    const readyForMedia = await ensureMediaPermissions();
    if (!readyForMedia) {
      return;
    }

    setSelectedContact(contact);

    await startCall({
      id: contact.id,
      name: contact.name,
      rawNumber: normalized,
      displayNumber: contact.number.displayNumber,
    });
  };

  const completeSpeakRegistration = async () => {
    setRegistrationError('Registration save is required in the next step.');
  };

  const handleOutgoingBack = async () => {
    await endCall();
    if (selectedContact) {
      setStack(['home', 'contacts', 'detail']);
      return;
    }
    goBack();
  };

  const handleIncomingBack = async () => {
    await declineCall();
    goHome();
  };

  const handleActiveBack = () => {
    minimizeCall();
    goHome();
  };

  const renderHeader = (title: string, subtitle?: string) => (
    <View style={styles.headerRow}>
      <TouchableOpacity style={styles.iconButton} onPress={goBack}>
        <Ionicons name="chevron-back" size={22} color={colors.secondary} />
      </TouchableOpacity>

      <View style={styles.headerCopy}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>

      <TouchableOpacity style={styles.iconButton} onPress={() => pushScreen('profile')}>
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.secondary} />
      </TouchableOpacity>
    </View>
  );

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
        <Text style={styles.contactMeta}>
          {cleanContactLabel(contact.number.label)} {'\u2022'} {contact.number.displayNumber}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.contactCallIconButton}
        onPress={() => {
          void startSpeakCallFromContact(contact);
        }}
      >
        <Ionicons name="call" size={18} color={colors.blue} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const homeView = (
    <View style={styles.homePanel}>
      <View style={styles.homeTopRow}>
        <TouchableOpacity style={styles.menuButton} onPress={() => pushScreen('contacts')}>
          <Ionicons name="call-outline" size={18} color={colors.secondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={() => pushScreen('profile')}>
          <Ionicons name="menu" size={20} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.homeLogo}>S</Text>
      <Text style={styles.homeTitle}>Speak</Text>
      <Text style={styles.homeTagline}>The world speaks here.</Text>

      <View style={styles.readyRing}>
        <View style={styles.readyRingInner}>
          <View style={styles.waveBars}>
            <View style={[styles.waveBar, styles.waveBarShort]} />
            <View style={[styles.waveBar, styles.waveBarMedium]} />
            <View style={[styles.waveBar, styles.waveBarTall]} />
            <View style={[styles.waveBar, styles.waveBarMedium]} />
            <View style={[styles.waveBar, styles.waveBarShort]} />
          </View>
          <Text style={styles.readyText}>Ready</Text>
        </View>
      </View>

      <Text style={styles.languagesTitle}>Speak languages</Text>
      <View style={styles.languageRow}>
        <Ionicons name="globe-outline" size={16} color={colors.secondary} />
        <Text style={styles.languageText}>English</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
      </View>
      <View style={styles.languageRow}>
        <Ionicons name="globe-outline" size={16} color={colors.secondary} />
        <Text style={styles.languageText}>Spanish</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
      </View>

      <TouchableOpacity style={styles.speakNowButton} onPress={() => pushScreen('contacts')}>
        <Ionicons name="mic" size={18} color={colors.text} />
        <Text style={styles.speakNowText}>Speak Now</Text>
      </TouchableOpacity>
    </View>
  );

  const contactsView = (
    <View style={styles.panel}>
      <View style={styles.contactsTopRow}>
        <View style={styles.contactsBrandRow}>
          <Text style={styles.contactsBrandS}>S</Text>
          <Text style={styles.contactsBrandText}>Speak</Text>
        </View>
        <TouchableOpacity style={styles.contactHeadIcon} onPress={() => pushScreen('keypad')}>
          <Ionicons name="call-outline" size={18} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.contactsTitle}>Contacts</Text>
      <Text style={styles.contactsSubtitle}>Find someone and start a call.</Text>

      <TouchableOpacity
        style={styles.contactsImportButton}
        onPress={() => {
          void openContactPicker();
        }}
        disabled={loadingContactPicker}
      >
        <Ionicons name={loadingContactPicker ? 'hourglass-outline' : 'person-add-outline'} size={16} color={colors.text} />
        <Text style={styles.contactsImportButtonText}>
          {loadingContactPicker ? 'Loading Contacts...' : 'Import iPhone Contacts'}
        </Text>
      </TouchableOpacity>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.secondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search contacts"
          placeholderTextColor={colors.secondary}
          style={styles.searchInput}
        />
        <TouchableOpacity>
          <Ionicons name="options-outline" size={16} color={colors.secondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.segment}>
        <TouchableOpacity style={styles.segmentActive} onPress={() => onTabPress('contacts')}>
          <Text style={styles.segmentActiveText}>Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.segmentInactive} onPress={() => onTabPress('recents')}>
          <Text style={styles.segmentInactiveText}>Recents</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filteredContacts.length ? filteredContacts.map(renderContactRow) : <Text style={styles.emptySectionText}>Add from iPhone Contacts to start calling.</Text>}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </ScrollView>
    </View>
  );

  const detailView = selectedContact ? (
    <View style={styles.panel}>
      {renderHeader('Speak')}

      <Text style={styles.detailEyebrow}>CONTACT DETAIL</Text>
      <Text style={styles.detailTitle}>Ready to Call.</Text>
      <Text style={styles.detailSubtitle}>Tap the button below to start a voice call immediately.</Text>

      <View style={styles.detailCard}>
        <View style={styles.detailAvatarWrap}>
          <Text style={styles.detailAvatarText}>{initials(selectedContact.name)}</Text>
        </View>
        <Text style={styles.detailName}>{selectedContact.name}</Text>
        <Text style={styles.detailNumber}>{selectedContact.number.displayNumber}</Text>
        <Text style={styles.detailLabel}>{cleanContactLabel(selectedContact.number.label)} GMT -5</Text>

        <View style={styles.detailInfoRow}>
          <View style={styles.detailInfoPill}>
            <Ionicons name="location-outline" size={13} color={colors.secondary} />
            <Text style={styles.detailInfoText}>Colombia</Text>
          </View>
          <View style={styles.detailInfoPill}>
            <Ionicons name="cellular-outline" size={13} color={colors.secondary} />
            <Text style={styles.detailInfoText}>Good Connection</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.callOrbOuter}
        onPress={() => {
          void startSpeakCallFromContact(selectedContact);
        }}
      >
        <View style={styles.callOrbInner}>
          <Ionicons name="call" size={34} color={colors.text} />
        </View>
      </TouchableOpacity>

      <View style={styles.detailActionsRow}>
        <TouchableOpacity style={styles.detailActionButton}>
          <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.secondary} />
          <Text style={styles.detailActionText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.detailActionButton}>
          <Ionicons name="videocam-outline" size={14} color={colors.secondary} />
          <Text style={styles.detailActionText}>Video Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : (
    <EmptyState title="No contact selected" message="Choose a contact to start a call." />
  );

  const favoritesView = (
    <View style={styles.panel}>
      {renderHeader('Favorites')}
      <FavoritesScreen
        contacts={favoriteContacts.map(item => ({
          id: `${item.id}-${item.number.rawNumber}`,
          name: item.name,
          number: item.number.displayNumber,
          isFavorite: true,
        }))}
        onCall={number => {
          const contact = favoriteContacts.find(item => item.number.displayNumber === number);
          if (contact) {
            void startSpeakCallFromContact(contact);
          }
        }}
      />
    </View>
  );

  const recentsView = (
    <View style={styles.panel}>
      {renderHeader('Recents')}
      <RecentsScreen
        recents={recents}
        onRedial={() => {
          Alert.alert('Speak contact required', 'Choose a Speak contact to start a Speak call.');
        }}
      />
    </View>
  );

  const keypadView = (
    <View style={styles.panelNoPadding}>
      <View style={styles.headerPad}>{renderHeader('Keypad')}</View>
      <KeypadScreen
        code={keypadCode}
        onChangeCode={setKeypadCode}
        onCall={() => {
          Alert.alert('Use contacts for Speak calls', 'Speak-to-Speak calling in this build starts from Contacts.');
        }}
      />
    </View>
  );

  const profileView = (
    <View style={styles.panel}>
      {renderHeader('My Speak Profile')}

      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>Display Name</Text>
        <TextInput
          value={profileName}
          onChangeText={setProfileName}
          placeholder="Your name"
          placeholderTextColor={colors.secondary}
          style={styles.profileInput}
        />

        <Text style={styles.profileLabel}>My Phone Number</Text>
        <TextInput
          value={profilePhone}
          onChangeText={setProfilePhone}
          placeholder="+1 555 123 4567"
          placeholderTextColor={colors.secondary}
          style={styles.profileInput}
          keyboardType="phone-pad"
        />

        <TouchableOpacity style={styles.profileSaveButton} onPress={() => void saveProfile()} disabled={savingProfile}>
          <Text style={styles.profileSaveText}>{savingProfile ? 'Saving...' : 'Save Profile'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  let content = homeView;
  if (screen === 'contacts') {
    content = contactsView;
  } else if (screen === 'detail') {
    content = detailView;
  } else if (screen === 'favorites') {
    content = favoritesView;
  } else if (screen === 'recents') {
    content = recentsView;
  } else if (screen === 'keypad') {
    content = keypadView;
  } else if (screen === 'profile') {
    content = profileView;
  }

  const minimizedBanner = callMinimized && phase === 'active' && currentCall ? (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => {
        restoreCall();
      }}
    >
      <Text style={styles.bannerText}>Active call with {currentCall.contactName} - Tap to return</Text>
    </TouchableOpacity>
  ) : null;

  const callOverlay = !callMinimized && currentCall ? (
    phase === 'incoming' ? (
      <IncomingCallScreen
        contact={{ name: currentCall.contactName, number: currentCall.contactNumber }}
        onBack={() => {
          void handleIncomingBack();
        }}
        onDecline={() => {
          void declineCall();
          goHome();
        }}
        onAnswer={() => {
          void (async () => {
            const readyForMedia = await ensureMediaPermissions();
            if (!readyForMedia) {
              return;
            }

            await acceptCall();
          })();
        }}
      />
    ) : phase === 'outgoing' ? (
      <OutgoingCallScreen
        contact={{ name: currentCall.contactName, number: currentCall.contactNumber }}
        callId={currentCall.id}
        recipientUserId={currentCall.calleeId}
        callStatus={currentCall.status}
        onBack={() => {
          void handleOutgoingBack();
        }}
        onEndCall={() => {
          void endCall();
          goBack();
        }}
      />
    ) : phase === 'active' ? (
      <ActiveCallScreen
        contact={{ name: currentCall.contactName, number: currentCall.contactNumber }}
        durationSeconds={activeDuration}
        muted={muted}
        onBack={handleActiveBack}
        onMute={() => {
          void toggleMute();
        }}
        onEndCall={() => {
          void endCall();
          goHome();
        }}
      />
    ) : phase === 'connecting' ? (
      <View style={styles.connectingOverlay}>
        <Text style={styles.connectingTitle}>Connecting...</Text>
      </View>
    ) : null
  ) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        {minimizedBanner}
        {content}
        {screen === 'home' && needsRegistration ? (
          <View style={styles.registrationOverlayWrap}>
            <View style={styles.registrationOverlayCard}>
              <Text style={styles.registrationOverlayTitle}>Complete your Speak registration</Text>
              <Text style={styles.registrationOverlaySubtitle}>Add your name and phone to be discoverable on Speak.</Text>

              <TextInput
                value={registrationName}
                onChangeText={value => {
                  setRegistrationName(value);
                  setRegistrationError('');
                }}
                placeholder="Name"
                placeholderTextColor={colors.secondary}
                style={styles.profileInput}
              />

              <TextInput
                value={registrationPhone}
                onChangeText={value => {
                  setRegistrationPhone(value);
                  setRegistrationError('');
                }}
                placeholder="+1 555 123 4567"
                placeholderTextColor={colors.secondary}
                style={styles.profileInput}
                keyboardType="phone-pad"
              />

              <TouchableOpacity style={styles.profileSaveButton} onPress={() => void completeSpeakRegistration()}>
                <Text style={styles.profileSaveText}>Join Speak</Text>
              </TouchableOpacity>

              {registrationError ? <Text style={styles.registrationOverlayError}>{registrationError}</Text> : null}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.tabsWrap}>
        <TouchableOpacity style={styles.navDotButton} onPress={goHome}>
          <Text style={styles.navDotText}>S</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navDotButton, screen === 'home' && styles.navDotButtonActive]}
          onPress={goHome}
        >
          <Ionicons name="home-outline" size={16} color={screen === 'home' ? colors.text : colors.secondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navDotButton, screen === 'contacts' && styles.navDotButtonActive]}
          onPress={() => {
            if (screen === 'contacts') {
              void openContactPicker();
              return;
            }
            onTabPress('contacts');
          }}
          disabled={loadingContactPicker}
        >
          <Ionicons
            name={screen === 'contacts' ? (loadingContactPicker ? 'hourglass-outline' : 'add') : 'people-outline'}
            size={18}
            color={screen === 'contacts' ? colors.text : colors.secondary}
          />
        </TouchableOpacity>
      </View>

      {callOverlay ? <View style={styles.callOverlay}>{callOverlay}</View> : null}
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
  panelNoPadding: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerPad: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  homePanel: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.background,
  },
  homeTopRow: {
    minHeight: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: radius.circle,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeLogo: {
    color: colors.cyan,
    fontSize: 52,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: 6,
    textShadowColor: colors.blue,
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  homeTitle: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 32,
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
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: colors.blueDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
  },
  readyRingInner: {
    width: 146,
    height: 146,
    borderRadius: 73,
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
  waveBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 36,
  },
  waveBar: {
    width: 4,
    borderRadius: 3,
    backgroundColor: colors.cyan,
  },
  waveBarShort: {
    height: 12,
  },
  waveBarMedium: {
    height: 22,
  },
  waveBarTall: {
    height: 32,
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
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 10,
  },
  languageText: {
    color: colors.text,
    fontSize: 16,
    flex: 1,
  },
  speakNowButton: {
    marginTop: 6,
    minHeight: 56,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.cyan,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  speakNowText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerCopy: {
    flex: 1,
    marginHorizontal: 10,
  },
  headerTitle: {
    color: colors.cyan,
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: colors.secondary,
    marginTop: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.circle,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactsTitle: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '800',
    marginTop: 12,
  },
  contactsSubtitle: {
    color: colors.secondary,
    marginTop: 2,
  },
  contactsImportButton: {
    marginTop: 14,
    marginBottom: 14,
    minHeight: 46,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.blueDeep,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  contactsImportButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  searchWrap: {
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  searchInput: {
    height: 44,
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
  segment: {
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
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
  list: {
    flex: 1,
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 96,
  },
  contactRow: {
    minHeight: 66,
    borderRadius: radius.small,
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
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
  },
  contactCallIconButton: {
    width: 32,
    height: 32,
    borderRadius: radius.circle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
  },
  detailEyebrow: {
    color: colors.cyan,
    fontWeight: '700',
    fontSize: 11,
    marginTop: 12,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 30,
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
    marginTop: 18,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 18,
    paddingHorizontal: 14,
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
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
  },
  detailInfoRow: {
    marginTop: 14,
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  detailInfoPill: {
    flex: 1,
    minHeight: 34,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
  },
  detailInfoText: {
    color: colors.secondary,
    fontSize: 12,
  },
  callOrbOuter: {
    alignSelf: 'center',
    marginTop: 16,
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 1,
    borderColor: colors.blueDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callOrbInner: {
    width: 86,
    height: 86,
    borderRadius: 43,
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
  profileCard: {
    marginTop: 16,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 8,
  },
  profileLabel: {
    color: colors.secondary,
    fontSize: 13,
  },
  profileInput: {
    minHeight: 44,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    color: colors.text,
    paddingHorizontal: 12,
  },
  profileSaveButton: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: radius.small,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSaveText: {
    color: colors.text,
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
  banner: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.small,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  tabsWrap: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  navDotButton: {
    width: 36,
    height: 36,
    borderRadius: radius.circle,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDotButtonActive: {
    borderColor: colors.cyan,
    shadowColor: colors.blue,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  navDotText: {
    color: colors.text,
    fontWeight: '700',
  },
  contactsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactsBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactsBrandS: {
    color: colors.cyan,
    fontWeight: '700',
    fontSize: 28,
    textShadowColor: colors.blue,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
  contactsBrandText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
  },
  contactHeadIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.circle,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailActionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  detailActionButton: {
    minHeight: 34,
    borderRadius: radius.circle,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  detailActionText: {
    color: colors.secondary,
    fontSize: 12,
  },
  callOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
  },
  connectingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  connectingTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  registrationOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 10, 18, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  registrationOverlayCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(98, 232, 255, 0.38)',
    backgroundColor: 'rgba(14, 20, 34, 0.72)',
    padding: 14,
    gap: 10,
  },
  registrationOverlayTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  registrationOverlaySubtitle: {
    color: colors.secondary,
    lineHeight: 20,
  },
  registrationOverlayError: {
    color: colors.red,
    marginTop: 2,
  },
});
