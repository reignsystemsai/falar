import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { setupSupabaseAuthRefresh } from './lib/supabase';
import { PhoneShell } from './features/phone/PhoneShell';

export default function App() {
  useEffect(() => {
    setupSupabaseAuthRefresh();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <PhoneShell />
    </>
  );
}
