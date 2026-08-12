import { createClient } from 'npm:@supabase/supabase-js@2';
import { AccessToken } from 'npm:livekit-server-sdk@2.17.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    const authorization =
      req.headers.get('Authorization');

    if (!authorization) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL');

    const publishableKeysRaw =
      Deno.env.get(
        'SUPABASE_PUBLISHABLE_KEYS'
      );

    const liveKitUrl =
      Deno.env.get('LIVEKIT_URL');

    const liveKitApiKey =
      Deno.env.get('LIVEKIT_API_KEY');

    const liveKitApiSecret =
      Deno.env.get('LIVEKIT_API_SECRET');

    if (
      !supabaseUrl ||
      !publishableKeysRaw ||
      !liveKitUrl ||
      !liveKitApiKey ||
      !liveKitApiSecret
    ) {
      throw new Error(
        'Required server configuration is missing.'
      );
    }

    const publishableKeys =
      JSON.parse(publishableKeysRaw);

    const supabase = createClient(
      supabaseUrl,
      publishableKeys.default,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const { call_id } =
      await req.json();

    if (!call_id) {
      return new Response(
        JSON.stringify({
          error: 'call_id is required',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const {
      data: call,
      error: callError,
    } = await supabase
      .from('app_calls')
      .select(
        'id, caller_id, callee_id, room_name, status'
      )
      .eq('id', call_id)
      .single();

    if (callError || !call) {
      return new Response(
        JSON.stringify({
          error: 'Call not found',
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const isParticipant =
      call.caller_id === user.id ||
      call.callee_id === user.id;

    if (!isParticipant) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const token =
      new AccessToken(
        liveKitApiKey,
        liveKitApiSecret,
        {
          identity: user.id,
          ttl: '15m',
        }
      );

    token.addGrant({
      roomJoin: true,
      room: call.room_name,
      canPublish: true,
      canSubscribe: true,
    });

    const participantToken =
      await token.toJwt();

    return new Response(
      JSON.stringify({
        server_url: liveKitUrl,
        participant_token:
          participantToken,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type':
            'application/json',
        },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type':
            'application/json',
        },
      }
    );
  }
});
