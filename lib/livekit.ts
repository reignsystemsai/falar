import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface LiveKitCredentials {
  serverUrl: string;
  participantToken: string;
}

function parseSafeFunctionErrorMessage(errorBody: unknown): string {
  if (typeof errorBody === 'string' && errorBody.trim()) {
    return errorBody;
  }

  if (errorBody && typeof errorBody === 'object') {
    const body = errorBody as Record<string, unknown>;
    if (typeof body.error === 'string' && body.error.trim()) {
      return body.error;
    }
    if (typeof body.message === 'string' && body.message.trim()) {
      return body.message;
    }
  }

  return 'livekit-token function error';
}

async function getFunctionsHttpErrorMessage(error: FunctionsHttpError): Promise<string> {
  const response = error.context as Response | undefined;

  if (!response) {
    return 'livekit-token function error';
  }

  try {
    const responseText = await response.text();
    if (!responseText) {
      return 'livekit-token function error';
    }

    try {
      return parseSafeFunctionErrorMessage(JSON.parse(responseText));
    } catch {
      return parseSafeFunctionErrorMessage(responseText);
    }
  } catch {
    return 'livekit-token function error';
  }
}

/**
 * Obtains a short-lived LiveKit participant token from the Edge Function.
 */
export async function getLiveKitToken(roomName: string): Promise<LiveKitCredentials> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    throw new Error('Supabase session missing. Please sign in again.');
  }

  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: {
      roomName,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      throw new Error(await getFunctionsHttpErrorMessage(error));
    }

    throw new Error(`livekit-token function error: ${error.message}`);
  }

  return {
    serverUrl: data.server_url,
    participantToken: data.participant_token,
  };
}
