import AsyncStorage from '@react-native-async-storage/async-storage';
import { Contact, RecentCall } from './phoneTypes';

const CONTACTS_KEY = 'speak_phone_contacts';
const RECENTS_KEY = 'speak_phone_recents';

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadContacts(): Promise<Contact[]> {
  return readJson<Contact[]>(CONTACTS_KEY, []);
}

export async function saveContacts(contacts: Contact[]): Promise<void> {
  await writeJson(CONTACTS_KEY, contacts);
}

export async function addContact(name: string, number: string): Promise<Contact[]> {
  const contacts = await loadContacts();
  const next: Contact = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name.trim(),
    number: number.trim(),
    isFavorite: false,
  };
  const updated = [next, ...contacts];
  await saveContacts(updated);
  return updated;
}

export async function toggleFavorite(contactId: string): Promise<Contact[]> {
  const contacts = await loadContacts();
  const updated = contacts.map(contact => {
    if (contact.id !== contactId) return contact;
    return { ...contact, isFavorite: !contact.isFavorite };
  });
  await saveContacts(updated);
  return updated;
}

export async function loadRecents(): Promise<RecentCall[]> {
  const recents = await readJson<RecentCall[]>(RECENTS_KEY, []);
  return recents.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

export async function addRecentCall(entry: RecentCall): Promise<RecentCall[]> {
  const recents = await loadRecents();
  const updated = [entry, ...recents].slice(0, 50);
  await writeJson(RECENTS_KEY, updated);
  return updated;
}
