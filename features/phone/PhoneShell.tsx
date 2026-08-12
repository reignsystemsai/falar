import { Contact } from 'expo-contacts';
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

  const [activeDuration, setActiveDuration] = useState(0);
  const activeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
        pushScreen('detail');
        return;
      }

      Alert.alert(
        contactName,
        'Which number do you want to use?',
        [
          ...options.map(option => ({
            text: `${option.label || 'Mobile'} ${option.displayNumber}`,
            onPress: () => {
              applyChosenNumber(picked.id, contactName, option);
              pushScreen('detail');
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
    pushScreen('detail');
  };

  const onTabPress = (next: PhoneScreen) => {
    if (next === screen) {
      return;
    }
    pushScreen(next);
  };

  const startSpeakCallFromContact = async (contact: SpeakContact) => {
    setSelectedContact(contact);

    await startCall({
      id: contact.id,
      name: contact.name,
      rawNumber: contact.number.rawNumber,
      displayNumber: contact.number.displayNumber,
    });
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

      <TouchableOpacity style={styles.iconButton} onPress={goHome}>
        <Ionicons name="home" size={18} color={colors.secondary} />
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

      <TouchableOpacity style={styles.favoriteButton} onPress={() => toggleFavorite(contact)}>
        <Ionicons name={contact.favorite ? 'star' : 'star-outline'} size={16} color={colors.secondary} />
      </TouchableOpacity>

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
      <TouchableOpacity style={styles.profileButton} onPress={() => pushScreen('profile')}>
        <Ionicons name="person-circle-outline" size={20} color={colors.secondary} />
        <Text style={styles.profileButtonText}>My Speak Profile</Text>
      </TouchableOpacity>

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
        <Text style={styles.languageText}>English</Text>
      </View>
      <View style={styles.languageRow}>
        <Text style={styles.languageText}>Spanish</Text>
      </View>

      <TouchableOpacity style={styles.speakNowButton} onPress={() => pushScreen('contacts')}>
        <Text style={styles.speakNowText}>Speak Now</Text>
      </TouchableOpacity>
    </View>
  );

  const contactsView = (
    <View style={styles.panel}>
      {renderHeader('S Speak')}

      <Text style={styles.contactsTitle}>Contacts</Text>
      <Text style={styles.contactsSubtitle}>Find someone and start a call.</Text>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.secondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search contacts"
          placeholderTextColor={colors.secondary}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.segment}>
        <TouchableOpacity style={styles.segmentActive} onPress={() => onTabPress('contacts')}>
          <Text style={styles.segmentActiveText}>Contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.segmentInactive} onPress={() => onTabPress('recents')}>
          <Text style={styles.segmentInactiveText}>Recents</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.pickButton} onPress={() => void openContactPicker()} disabled={loadingContactPicker}>
        <Ionicons name="person-add" size={18} color={colors.text} />
        <Text style={styles.pickButtonText}>{loadingContactPicker ? 'Opening Contacts...' : 'Add from iPhone Contacts'}</Text>
      </TouchableOpacity>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {filteredContacts.length ? filteredContacts.map(renderContactRow) : <Text style={styles.emptySectionText}>Add from iPhone Contacts to start calling.</Text>}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </ScrollView>
    </View>
  );

  const detailView = selectedContact ? (
    <View style={styles.panel}>
      {renderHeader('S Speak')}

      <Text style={styles.detailEyebrow}>CONTACT DETAIL</Text>
      <Text style={styles.detailTitle}>Ready to Call.</Text>
      <Text style={styles.detailSubtitle}>Tap the button below to start a voice call immediately.</Text>

      <View style={styles.detailCard}>
        <View style={styles.detailAvatarWrap}>
          <Text style={styles.detailAvatarText}>{initials(selectedContact.name)}</Text>
        </View>
        <Text style={styles.detailName}>{selectedContact.name}</Text>
        <Text style={styles.detailNumber}>{selectedContact.number.displayNumber}</Text>
        <Text style={styles.detailLabel}>{cleanContactLabel(selectedContact.number.label)}</Text>
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
          void acceptCall();
        }}
      />
    ) : phase === 'outgoing' ? (
      <OutgoingCallScreen
        contact={{ name: currentCall.contactName, number: currentCall.contactNumber }}
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
      </View>

      {screen !== 'home' ? (
        <View style={styles.tabsWrap}>
          <TouchableOpacity style={styles.tabButton} onPress={() => onTabPress('favorites')}>
            <Ionicons name="star-outline" size={18} color={screen === 'favorites' ? colors.text : colors.secondary} />
            <Text style={[styles.tabLabel, screen === 'favorites' && styles.tabLabelActive]}>Favorites</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabButton} onPress={() => onTabPress('recents')}>
            <Ionicons name="time-outline" size={18} color={screen === 'recents' ? colors.text : colors.secondary} />
            <Text style={[styles.tabLabel, screen === 'recents' && styles.tabLabelActive]}>Recents</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabButton} onPress={() => onTabPress('contacts')}>
            <Ionicons name="people-outline" size={18} color={screen === 'contacts' || screen === 'detail' ? colors.text : colors.secondary} />
            <Text style={[styles.tabLabel, (screen === 'contacts' || screen === 'detail') && styles.tabLabelActive]}>Contacts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tabButton} onPress={() => onTabPress('keypad')}>
            <Ionicons name="keypad-outline" size={18} color={screen === 'keypad' ? colors.text : colors.secondary} />
            <Text style={[styles.tabLabel, screen === 'keypad' && styles.tabLabelActive]}>Keypad</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
    paddingTop: 24,
    backgroundColor: colors.background,
  },
  profileButton: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.small,
    paddingHorizontal: 10,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileButtonText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  homeLogo: {
    color: colors.cyan,
    fontSize: 58,
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
    borderRadius: radius.medium,
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
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  pickButton: {
    minHeight: 48,
    borderRadius: radius.small,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
    width: 36,
    height: 36,
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
    borderRadius: radius.medium,
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
  },
  tabButton: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    color: colors.secondary,
    fontSize: 12,
  },
  tabLabelActive: {
    color: colors.text,
    fontWeight: '700',
  },
  callOverlay: {
    ...StyleSheet.absoluteFillObject,
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
});
