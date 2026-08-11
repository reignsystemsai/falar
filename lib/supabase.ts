import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('supabase-auth.db');

db.execSync(
  'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
);

// Synchronous KV store backed by expo-sqlite for persisted auth sessions
const ExpoSQLiteStorage = {
  getItem: (key: string): string | null => {
    const row = db.getFirstSync<{ value: string }>(
      'SELECT value FROM kv WHERE key = ?',
      [key]
    );
    return row?.value ?? null;
  },
  setItem: (key: string, value: string): void => {
    db.runSync(
      'INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)',
      [key, value]
    );
  },
  removeItem: (key: string): void => {
    db.runSync('DELETE FROM kv WHERE key = ?', [key]);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSQLiteStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
