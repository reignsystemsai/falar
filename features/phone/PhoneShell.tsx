import * as Contacts from 'expo-contacts';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CallButton } from './components/CallButton';
import { EmptyState } from './components/EmptyState';
import { PhoneTabs } from './PhoneTabs';
import { KeypadScreen } from './screens/KeypadScreen';
import { PhoneTabKey } from './phoneTypes';
import { placePhoneCall } from './phoneCall';
import { supabase } from '../../lib/supabase';

type ContactNumberOption = {
  rawNumber: string;
  displayNumber: string;
  label?: string;
};

type PickedContactShape = {
  name?: string;
  phoneNumbers?: Array<{
    number?: string | null;
    label?: string | null;
  }>;
};

type SelectedContact = {
  name: string;
  number: ContactNumberOption;
};

export function PhoneShell() {
  const [activeTab, setActiveTab] = useState<PhoneTabKey>('contacts');
  const [keypadCode, setKeypadCode] = useState('');
  const [loadingContactPicker, setLoadingContactPicker] = useState(false);
  const [notice, setNotice] = useState('');
  const [selectedContact, setSelectedContact] = useState<SelectedContact | null>(null);
  const [pendingNumbers, setPendingNumbers] = useState<{ name: string; options: ContactNumberOption[] } | null>(null);

  const canCallSelectedContact = useMemo(() => !!selectedContact?.number.rawNumber, [selectedContact]);

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
      setNotice('Contact save failed. Calling is still available.');
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

  const callNumber = async (rawNumber: string, contactName?: string) => {
    setNotice('');

    void logCallRequest(rawNumber, contactName);

    try {
      await placePhoneCall(rawNumber);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to place call.');
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

  const extractNumbers = (contact: PickedContactShape): ContactNumberOption[] => {
    const numbers = contact.phoneNumbers ?? [];
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
        displayNumber: normalized,
        label: item.label || undefined,
      });
    }

    return options;
  };

  const openContactPicker = async () => {
    setNotice('');
    setPendingNumbers(null);
    setSelectedContact(null);

    setLoadingContactPicker(true);

    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        setNotice('Contacts permission denied.');
        return;
      }

      const picked = await Contacts.presentContactPickerAsync();

      if (!picked) {
        return;
      }

      const options = extractNumbers(picked as PickedContactShape);
      const contactName = picked.name?.trim() || 'Unknown contact';

      if (options.length === 0) {
        setNotice('Selected contact has no phone numbers.');
        return;
      }

      if (options.length === 1) {
        setSelectedContact({ name: contactName, number: options[0] });
        void saveSelectedContact(contactName, [options[0].rawNumber]);
        return;
      }

      setPendingNumbers({ name: contactName, options });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to open contacts.');
    } finally {
      setLoadingContactPicker(false);
    }
  };

  const contactsView = (
    <View style={styles.panel}>
      <TouchableOpacity style={styles.pickButton} onPress={() => void openContactPicker()} disabled={loadingContactPicker}>
        <Text style={styles.pickButtonText}>{loadingContactPicker ? 'Opening Contacts...' : 'Choose From iPhone Contacts'}</Text>
      </TouchableOpacity>

      {loadingContactPicker ? <ActivityIndicator color="#1a1a2e" style={styles.loader} /> : null}

      {pendingNumbers ? (
        <View style={styles.selectionWrap}>
          <Text style={styles.selectionTitle}>Choose a number for {pendingNumbers.name}</Text>
          {pendingNumbers.options.map(option => (
            <TouchableOpacity
              key={`${pendingNumbers.name}-${option.rawNumber}`}
              style={styles.numberRow}
              onPress={() => {
                setSelectedContact({ name: pendingNumbers.name, number: option });
                void saveSelectedContact(pendingNumbers.name, [option.rawNumber]);
                setPendingNumbers(null);
              }}
            >
              <Text style={styles.numberLabel}>{option.label || 'Phone'}</Text>
              <Text style={styles.numberValue}>{option.displayNumber}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {selectedContact ? (
        <View style={styles.selectedWrap}>
          <Text style={styles.selectedName}>{selectedContact.name}</Text>
          <Text style={styles.selectedNumber}>
            {selectedContact.number.label ? `${selectedContact.number.label}: ` : ''}
            {selectedContact.number.displayNumber}
          </Text>
        </View>
      ) : null}

      <CallButton
        disabled={!canCallSelectedContact}
        onPress={() => {
          if (!selectedContact) {
            return;
          }
          void callNumber(selectedContact.number.rawNumber, selectedContact.name);
        }}
      />

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );

  const keypadView = (
    <KeypadScreen
      code={keypadCode}
      onChangeCode={setKeypadCode}
      onCall={number => {
        void callNumber(number);
      }}
    />
  );

  const emptyView = (
    <EmptyState
      title="Not part of Build #9"
      message="Use Contacts or Keypad to place a real phone call."
    />
  );

  const content =
    activeTab === 'contacts'
      ? contactsView
      : activeTab === 'keypad'
        ? keypadView
        : emptyView;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>Speak</Text>
      </View>

      <View style={styles.content}>{content}</View>
      <PhoneTabs activeTab={activeTab} onChange={setActiveTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f7f7f8',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  wordmark: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1a1a2e',
  },
  content: {
    flex: 1,
  },
  panel: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  pickButton: {
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  loader: {
    marginTop: 14,
  },
  selectionWrap: {
    marginTop: 16,
  },
  selectionTitle: {
    color: '#1a1a2e',
    fontWeight: '700',
    marginBottom: 8,
  },
  numberRow: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  numberLabel: {
    color: '#666',
    fontSize: 12,
    marginBottom: 2,
  },
  numberValue: {
    color: '#1a1a2e',
    fontWeight: '700',
    fontSize: 15,
  },
  selectedWrap: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedName: {
    color: '#1a1a2e',
    fontWeight: '700',
    fontSize: 16,
  },
  selectedNumber: {
    marginTop: 4,
    color: '#555',
  },
  notice: {
    marginTop: 12,
    color: '#9b2226',
    fontWeight: '600',
  },
});
