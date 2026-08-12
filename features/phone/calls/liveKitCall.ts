import { isKrispNoiseFilterSupported, KrispNoiseFilter } from '@livekit/react-native-krisp-noise-filter';
import { LocalAudioTrack, Room } from 'livekit-client';
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
    });

  await room.connect(
    data.server_url,
    data.participant_token
  );

  const micPublication = await room.localParticipant
    .setMicrophoneEnabled(true);

  // Krisp suppresses background noise on the outbound mic only; it does not
  // replace the echo cancellation configured above.
  const micTrack = micPublication?.audioTrack;
  if (micTrack instanceof LocalAudioTrack && isKrispNoiseFilterSupported()) {
    await micTrack.setProcessor(KrispNoiseFilter());
  }

  return room;
}
