import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { PhoneTabs } from './PhoneTabs';
import { PhoneTabKey } from './phoneTypes';
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

  const renderScreen = () => {
    if (activeTab === 'favorites') {
      return <FavoritesScreen />;
    }

    if (activeTab === 'recents') {
      return <RecentsScreen />;
    }

    if (activeTab === 'contacts') {
      return <ContactsScreen />;
    }

    return <KeypadScreen code={code} onChangeCode={value => setCode(normalizeVisibleCode(value))} onCall={() => {}} />;
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
