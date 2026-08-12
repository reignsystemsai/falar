import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { AudioSession } from '@livekit/react-native';
import { Room } from 'livekit-client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { connectSpeakRoom } from './liveKitCall';
import { normalizeSpeakNumber } from './phoneFormatting';

export type CallPhase =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'active';

export type SpeakCallTarget = {
  id: string;
  name: string;
  rawNumber: string;
  displayNumber: string;
};

type CurrentCall = {
  id: string;
  callerId: string;
  calleeId: string;
  roomName: string;
  contactName: string;
  contactNumber: string;
  initiatedByMe: boolean;
};

type AppCallRow = {
  id: string;
  caller_id: string;
  callee_id: string;
  room_name: string;
  status: 'ringing' | 'accepted' | 'declined' | 'ended' | 'failed';
  answered_at: string | null;
  ended_at: string | null;
};

type ResolveRow = {
  user_id: string;
  display_name: string;
};

type SpeakCallContextValue = {
  phase: CallPhase;
  currentCall: CurrentCall | null;
  muted: boolean;
  callMinimized: boolean;
  startCall: (target: SpeakCallTarget) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => Promise<void>;
  minimizeCall: () => void;
  restoreCall: () => void;
};

const SpeakCallContext = createContext<SpeakCallContextValue | null>(null);

async function ensureUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user?.id) {
    return session.user.id;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user?.id) {
    return null;
  }

  return data.user.id;
}

async function disconnectRoom(roomRef: React.MutableRefObject<Room | null>) {
  if (roomRef.current) {
    roomRef.current.disconnect();
    roomRef.current = null;
  }

  try {
    await AudioSession.stopAudioSession();
  } catch {
    // Ignore teardown errors if audio session is not active.
  }
}

export function SpeakCallProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [callMinimized, setCallMinimized] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const incomingChannelRef = useRef<RealtimeChannel | null>(null);
  const activeCallChannelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);

  const clearCallState = useCallback(async () => {
    await disconnectRoom(roomRef);

    if (activeCallChannelRef.current) {
      await supabase.removeChannel(activeCallChannelRef.current);
      activeCallChannelRef.current = null;
    }

    setCurrentCall(null);
    setMuted(false);
    setCallMinimized(false);
    setPhase('idle');
  }, []);

  const watchActiveCall = useCallback(
    async (callId: string) => {
      if (activeCallChannelRef.current) {
        await supabase.removeChannel(activeCallChannelRef.current);
        activeCallChannelRef.current = null;
      }

      const channel = supabase
        .channel(`active-call:${callId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'app_calls',
            filter: `id=eq.${callId}`,
          },
          async payload => {
            const row = payload.new as AppCallRow;

            if (row.status === 'accepted' && phase === 'outgoing') {
              try {
                setPhase('connecting');
                const room = await connectSpeakRoom(callId);
                roomRef.current = room;
                setMuted(false);
                setPhase('active');
              } catch (error) {
                await clearCallState();
                Alert.alert('Call failed', error instanceof Error ? error.message : 'Unable to connect call.');
              }
            }

            if (row.status === 'declined' || row.status === 'ended' || row.status === 'failed') {
              await clearCallState();
            }
          }
        )
        .subscribe();

      activeCallChannelRef.current = channel;
    },
    [clearCallState, phase]
  );

  const startCall = useCallback(
    async (target: SpeakCallTarget) => {
      const callerId = userIdRef.current || (await ensureUserId());
      userIdRef.current = callerId;

      if (!callerId) {
        Alert.alert('Unavailable', 'Could not identify the current Speak user.');
        return;
      }

      const normalized = normalizeSpeakNumber(target.rawNumber || target.displayNumber);

      if (!normalized) {
        Alert.alert('Country code required', 'Add the country code to this contact before using Speak calling.');
        return;
      }

      const { data: recipients, error: resolveError } = await supabase.rpc('resolve_speak_user', {
        p_phone_e164: normalized,
      });

      if (resolveError) {
        Alert.alert('Lookup failed', resolveError.message);
        return;
      }

      const recipient = (recipients as ResolveRow[] | null)?.[0];

      if (!recipient) {
        Alert.alert('Not on Speak', 'This person is not on Speak yet.');
        return;
      }

      const { data: call, error: callError } = await supabase
        .from('app_calls')
        .insert({
          caller_id: callerId,
          callee_id: recipient.user_id,
          status: 'ringing',
        })
        .select('id, caller_id, callee_id, room_name, status, answered_at, ended_at')
        .single();

      if (callError || !call) {
        Alert.alert('Call failed', callError?.message || 'Unable to start call.');
        return;
      }

      setCurrentCall({
        id: call.id,
        callerId: call.caller_id,
        calleeId: call.callee_id,
        roomName: call.room_name,
        contactName: target.name,
        contactNumber: normalized,
        initiatedByMe: true,
      });
      setCallMinimized(false);
      setPhase('outgoing');

      await watchActiveCall(call.id);
    },
    [watchActiveCall]
  );

  const hydrateCallerProfile = useCallback(async (callerId: string): Promise<{ name: string; number: string }> => {
    const { data } = await supabase
      .from('speak_profiles')
      .select('display_name, phone_e164')
      .eq('user_id', callerId)
      .maybeSingle();

    return {
      name: (data?.display_name as string | undefined) || 'Speak User',
      number: (data?.phone_e164 as string | undefined) || 'Unknown number',
    };
  }, []);

  const acceptCall = useCallback(async () => {
    if (!currentCall) {
      return;
    }

    const { error } = await supabase
      .from('app_calls')
      .update({
        status: 'accepted',
        answered_at: new Date().toISOString(),
      })
      .eq('id', currentCall.id);

    if (error) {
      Alert.alert('Call failed', error.message);
      return;
    }

    try {
      setPhase('connecting');
      const room = await connectSpeakRoom(currentCall.id);
      roomRef.current = room;
      setMuted(false);
      setCallMinimized(false);
      setPhase('active');
      await watchActiveCall(currentCall.id);
    } catch (connectError) {
      await clearCallState();
      Alert.alert('Call failed', connectError instanceof Error ? connectError.message : 'Unable to connect call.');
    }
  }, [clearCallState, currentCall, watchActiveCall]);

  const declineCall = useCallback(async () => {
    if (!currentCall) {
      await clearCallState();
      return;
    }

    await supabase
      .from('app_calls')
      .update({ status: 'declined' })
      .eq('id', currentCall.id);

    await clearCallState();
  }, [clearCallState, currentCall]);

  const endCall = useCallback(async () => {
    if (!currentCall) {
      await clearCallState();
      return;
    }

    await supabase
      .from('app_calls')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', currentCall.id);

    await clearCallState();
  }, [clearCallState, currentCall]);

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) {
      return;
    }

    const nextMuted = !muted;

    await room.localParticipant.setMicrophoneEnabled(!nextMuted);
    setMuted(nextMuted);
  }, [muted]);

  const minimizeCall = useCallback(() => {
    if (phase === 'active') {
      setCallMinimized(true);
    }
  }, [phase]);

  const restoreCall = useCallback(() => {
    setCallMinimized(false);
  }, []);

  useEffect(() => {
    let active = true;

    const setupIncoming = async () => {
      const userId = await ensureUserId();
      userIdRef.current = userId;

      if (!active || !userId) {
        return;
      }

      if (incomingChannelRef.current) {
        await supabase.removeChannel(incomingChannelRef.current);
      }

      const channel = supabase
        .channel(`incoming:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'app_calls',
            filter: `callee_id=eq.${userId}`,
          },
          async payload => {
            const call = payload.new as AppCallRow;

            if (call.status === 'ringing') {
              const caller = await hydrateCallerProfile(call.caller_id);

              setCurrentCall({
                id: call.id,
                callerId: call.caller_id,
                calleeId: call.callee_id,
                roomName: call.room_name,
                contactName: caller.name,
                contactNumber: caller.number,
                initiatedByMe: false,
              });
              setCallMinimized(false);
              setPhase('incoming');
              await watchActiveCall(call.id);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'app_calls',
            filter: `callee_id=eq.${userId}`,
          },
          async payload => {
            const call = payload.new as AppCallRow;

            if (call.status === 'ended' || call.status === 'declined' || call.status === 'failed') {
              await clearCallState();
            }
          }
        )
        .subscribe();

      incomingChannelRef.current = channel;
    };

    void setupIncoming();

    return () => {
      active = false;
      void clearCallState();
      if (incomingChannelRef.current) {
        void supabase.removeChannel(incomingChannelRef.current);
        incomingChannelRef.current = null;
      }
    };
  }, [clearCallState, hydrateCallerProfile, watchActiveCall]);

  const value = useMemo<SpeakCallContextValue>(
    () => ({
      phase,
      currentCall,
      muted,
      callMinimized,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      toggleMute,
      minimizeCall,
      restoreCall,
    }),
    [
      acceptCall,
      callMinimized,
      currentCall,
      declineCall,
      endCall,
      minimizeCall,
      muted,
      phase,
      restoreCall,
      startCall,
      toggleMute,
    ]
  );

  return (
    <SpeakCallContext.Provider value={value}>
      {children}
    </SpeakCallContext.Provider>
  );
}

export function useSpeakCall(): SpeakCallContextValue {
  const context = useContext(SpeakCallContext);

  if (!context) {
    throw new Error('useSpeakCall must be used within SpeakCallProvider.');
  }

  return context;
}
