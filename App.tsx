import { StatusBar } from 'expo-status-bar';
import { AuthGate } from './features/auth/AuthGate';
import { PhoneShell } from './features/phone/PhoneShell';

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <AuthGate>
        <PhoneShell />
      </AuthGate>
    </>
  );
}
