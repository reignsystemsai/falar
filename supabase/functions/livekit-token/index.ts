// @ts-ignore: Deno-only import
import { createClient } from 'npm:@supabase/supabase-js@2';
// @ts-ignore: Deno-only import
import { AccessToken } from 'npm:livekit-server-sdk';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders(),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader) {
      console.error('livekit-token: missing Authorization header');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publishableKeysRaw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');

    if (!supabaseUrl || !publishableKeysRaw) {
      console.error('livekit-token: missing Supabase auth env');
      return jsonResponse({ error: 'Supabase auth not configured' }, 500);
    }

    let publishableKey: string | undefined;
    try {
      const publishableKeys = JSON.parse(publishableKeysRaw) as { default?: string };
      publishableKey = publishableKeys.default;
    } catch {
      console.error('livekit-token: invalid Supabase publishable keys');
      return jsonResponse({ error: 'Supabase auth not configured' }, 500);
    }

    if (!publishableKey) {
      console.error('livekit-token: missing default Supabase publishable key');
      return jsonResponse({ error: 'Supabase auth not configured' }, 500);
    }

    const livekitUrl = Deno.env.get('LIVEKIT_URL');
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');

    if (!livekitUrl || !apiKey || !apiSecret) {
      console.error('livekit-token: missing LiveKit secrets');
      return jsonResponse({ error: 'LiveKit secrets not configured' }, 500);
    }

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: {
          Authorization: authorizationHeader,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      console.error('livekit-token: Supabase user validation failed');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const roomName: string = typeof body.roomName === 'string' && body.roomName.trim()
      ? body.roomName.trim()
      : typeof body.room === 'string' && body.room.trim()
      ? body.room.trim()
      : 'default-room';
    const identity: string = typeof body.identity === 'string' && body.identity.trim()
      ? body.identity.trim()
      : `guest-${crypto.randomUUID()}`;

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: '1h',
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });

    const participantToken = await token.toJwt();

    return jsonResponse({
      server_url: livekitUrl,
      participant_token: participantToken,
      room_name: roomName,
    });
  } catch (err) {
    console.error('livekit-token: token generation failed');
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
