import { AudioSession } from '@livekit/react-native';
import { Room } from 'livekit-client';
import { supabase } from '../../../lib/supabase';

export async function connectSpeakRoom(
  callId: string
): Promise<Room> {
  const { data, error } = await supabase.functions.invoke(
    'livekit-token',
    {
      body: {
        call_id: callId,
      },
    }
  );

  if (error) {
    throw error;
  }

  if (
    !data?.server_url ||
    !data?.participant_token
  ) {
    throw new Error(
      'LiveKit token response is invalid.'
    );
  }

  const room =
    new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

  // Default to the earpiece so two nearby phones don't blast each other's
  // mic through the loudspeaker, which is the source of the close-range
  // feedback/metallic artifacts.
  await AudioSession.configureAudio({
    ios: { defaultOutput: 'earpiece' },
  });
  await AudioSession.startAudioSession();

  await room.connect(
    data.server_url,
    data.participant_token
  );

  await room.localParticipant
    .setMicrophoneEnabled(true, {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });

  return room;
}
