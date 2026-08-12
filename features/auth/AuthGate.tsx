import React, { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Session } from '@supabase/supabase-js';
import { setupSupabaseAuthRefresh, supabase } from '../../lib/supabase';
import { SignInScreen } from './SignInScreen';
import { ensureSpeakDiscoveryProfile } from './ensureSpeakDiscoveryProfile';

type AuthGateState = 'BOOTING' | 'SIGNED_OUT' | 'SIGNED_IN';

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [state, setState] = useState<AuthGateState>('BOOTING');

  useEffect(() => {
    setupSupabaseAuthRefresh();

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      await ensureSpeakDiscoveryProfile(data.session);
      setState(data.session ? 'SIGNED_IN' : 'SIGNED_OUT');
    };

    bootstrap();

    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      void ensureSpeakDiscoveryProfile(session);
      setState(session ? 'SIGNED_IN' : 'SIGNED_OUT');
    });

    return () => {
      authSubscription.subscription.unsubscribe();
    };
  }, []);

  if (state === 'BOOTING') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.wordmark}>Speak</Text>
          <ActivityIndicator color="#1a1a2e" />
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'SIGNED_OUT') {
    return <SignInScreen onSignedIn={() => setState('SIGNED_IN')} />;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f7f8' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1a1a2e',
    marginBottom: 14,
  },
});
