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

let sessionPromise: Promise<string> | null = null;

async function ensureSessionAccessToken(): Promise<string> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const {
        data: { session: existingSession },
      } = await supabase.auth.getSession();

      if (existingSession?.access_token) {
        return existingSession.access_token;
      }

      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.session?.access_token || !data.user) {
        throw new Error('Unable to start call.');
      }

      return data.session.access_token;
    })().finally(() => {
      sessionPromise = null;
    });
  }

  return sessionPromise;
}

/**
 * Obtains a short-lived LiveKit participant token from the Edge Function.
 */
export async function getLiveKitToken(roomName: string): Promise<LiveKitCredentials> {
  const accessToken = await ensureSessionAccessToken();

  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: {
      roomName,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
