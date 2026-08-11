import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { Contact } from '../phoneTypes';

interface ContactsScreenProps {
  contacts: Contact[];
  contactName: string;
  contactNumber: string;
  onChangeContactName: (value: string) => void;
  onChangeContactNumber: (value: string) => void;
  onSaveContact: () => void;
  onToggleFavorite: (contactId: string) => void;
  onCall: (number: string) => void;
}

export function ContactsScreen({
  contacts,
  contactName,
  contactNumber,
  onChangeContactName,
  onChangeContactNumber,
  onSaveContact,
  onToggleFavorite,
  onCall,
}: ContactsScreenProps) {
  const content = contacts.length === 0 ? (
    <EmptyState
      title="No contacts"
      message="Save Speak call codes as contacts for one-tap dialing."
    />
  ) : (
    <FlatList
      data={contacts}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => onCall(item.number)}>
          <View>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.number}>{item.number}</Text>
          </View>
          <TouchableOpacity onPress={() => onToggleFavorite(item.id)}>
            <Text style={styles.favorite}>{item.isFavorite ? '★' : '☆'}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
      style={styles.list}
    />
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Add Contact</Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={contactName}
        onChangeText={onChangeContactName}
      />
      <TextInput
        style={styles.input}
        placeholder="Speak call code"
        keyboardType="number-pad"
        value={contactNumber}
        onChangeText={onChangeContactNumber}
      />
      <TouchableOpacity style={styles.button} onPress={onSaveContact}>
        <Text style={styles.buttonText}>Save Contact</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, styles.listTitle]}>Saved Contacts</Text>
      <View style={styles.listContainer}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#1a1a2e',
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  listTitle: {
    marginTop: 14,
  },
  listContainer: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f7f7f8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  name: {
    fontSize: 16,
    color: '#1a1a2e',
    fontWeight: '700',
  },
  number: {
    color: '#555',
    marginTop: 2,
  },
  favorite: {
    fontSize: 24,
    color: '#d69e2e',
  },
});
