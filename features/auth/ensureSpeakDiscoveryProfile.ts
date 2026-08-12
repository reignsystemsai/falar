import { Session } from '@supabase/supabase-js';
import { normalizeSpeakNumber } from '../phone/calls/phoneFormatting';
import { supabase } from '../../lib/supabase';

type SpeakProfileRow = {
  display_name: string | null;
};

type SpeakProfileIdentityRow = {
  phone_e164: string | null;
};

function getSessionPhoneE164(session: Session | null): string | null {
  const metadata = session?.user?.user_metadata as Record<string, unknown> | undefined;
  const rawPhone =
    (typeof session?.user?.phone === 'string' ? session.user.phone : null) ||
    (typeof metadata?.phone === 'string' ? metadata.phone : null) ||
    (typeof metadata?.phone_number === 'string' ? metadata.phone_number : null);

  if (!rawPhone) {
    return null;
  }

  return normalizeSpeakNumber(rawPhone);
}

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

export async function ensureSpeakDiscoveryProfile(session: Session | null): Promise<void> {
  const userId = session?.user?.id;
  if (!userId) {
    return;
  }

  const normalizedPhone = getSessionPhoneE164(session);
  if (!normalizedPhone) {
    return;
  }

  const metadata = session.user.user_metadata as Record<string, unknown> | undefined;

  const { data: existing } = await supabase
    .from('speak_profiles')
    .select('display_name')
    .eq('user_id', userId)
    .maybeSingle<SpeakProfileRow>();

  const existingDisplayName = existing?.display_name?.trim() || null;
  const candidateDisplayName =
    firstNonEmpty([
      typeof metadata?.display_name === 'string' ? metadata.display_name : null,
      typeof metadata?.full_name === 'string' ? metadata.full_name : null,
      typeof metadata?.name === 'string' ? metadata.name : null,
      session.user.email?.split('@')[0],
    ]) || 'Speak User';

  const upsertPayload: {
    user_id: string;
    phone_e164: string;
    updated_at: string;
    display_name?: string;
  } = {
    user_id: userId,
    phone_e164: normalizedPhone,
    updated_at: new Date().toISOString(),
  };

  if (!existingDisplayName) {
    upsertPayload.display_name = candidateDisplayName;
  }

  const { error } = await supabase.from('speak_profiles').upsert(upsertPayload, {
    onConflict: 'user_id',
  });

  if (error) {
    console.warn('Unable to ensure Speak discovery profile.', error.message);
  }
}

export async function hasCompleteSpeakDiscoveryProfile(session: Session | null): Promise<boolean> {
  const userId = session?.user?.id;
  if (!userId) {
    return false;
  }

  const { data, error } = await supabase
    .from('speak_profiles')
    .select('phone_e164')
    .eq('user_id', userId)
    .maybeSingle<SpeakProfileIdentityRow>();

  if (error) {
    return false;
  }

  const normalized = data?.phone_e164 ? normalizeSpeakNumber(data.phone_e164) : null;
  return Boolean(normalized && normalized === data?.phone_e164);
}
