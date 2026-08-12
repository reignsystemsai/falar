import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { setupSupabaseAuthRefresh } from './lib/supabase';
import { SpeakCallProvider } from './features/phone/calls/SpeakCallProvider';
import { PhoneShell } from './features/phone/PhoneShell';

export default function App() {
  useEffect(() => {
    setupSupabaseAuthRefresh();
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <SpeakCallProvider>
        <PhoneShell />
      </SpeakCallProvider>
    </>
  );
}
