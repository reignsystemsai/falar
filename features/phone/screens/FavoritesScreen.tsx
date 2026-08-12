import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { Contact } from '../phoneTypes';
import { SpeakPhoneTheme } from '../speakPhoneTheme';

const { colors } = SpeakPhoneTheme;

interface FavoritesScreenProps {
  contacts: Contact[];
  onCall: (number: string) => void;
}

export function FavoritesScreen({ contacts, onCall }: FavoritesScreenProps) {
  const favorites = contacts.filter(contact => contact.isFavorite);

  if (favorites.length === 0) {
    return (
      <EmptyState
        title="No favorites yet"
        message="Add contacts and mark them as favorites for quick calls."
      />
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={favorites}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => onCall(item.number)}>
          <View>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.number}>{item.number}</Text>
          </View>
          <Text style={styles.call}>Call</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  number: {
    marginTop: 2,
    color: colors.secondary,
  },
  call: {
    color: colors.blue,
    fontWeight: '700',
  },
});
