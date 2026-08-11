import { StatusBar } from 'expo-status-bar';
import CallTestScreen from './screens/CallTestScreen';
import { AuthGate } from './features/auth/AuthGate';

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <AuthGate>
        <CallTestScreen />
      </AuthGate>
    </>
  );
}
