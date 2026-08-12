create or replace function public.resolve_speak_user(
  p_phone_e164 text
)
returns table (
  user_id uuid,
  display_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sp.user_id,
    sp.display_name
  from public.speak_profiles sp
  where sp.phone_e164 = p_phone_e164
    and sp.user_id <> auth.uid()
  limit 1;
$$;

revoke all
on function public.resolve_speak_user(text)
from public;

grant execute
on function public.resolve_speak_user(text)
to authenticated;