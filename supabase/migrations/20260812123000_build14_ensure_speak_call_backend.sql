create table if not exists public.speak_profiles (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,
  display_name text not null,
  phone_e164 text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null
    references auth.users(id)
    on delete cascade,
  callee_id uuid not null
    references auth.users(id)
    on delete cascade,
  room_name text not null unique
    default ('speak-' || gen_random_uuid()::text),
  status text not null default 'ringing'
    check (status in ('ringing', 'accepted', 'declined', 'ended', 'failed')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  constraint app_calls_not_self check (caller_id <> callee_id)
);

alter table if exists public.speak_profiles
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.app_calls
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists answered_at timestamptz,
  add column if not exists ended_at timestamptz;

create unique index if not exists speak_profiles_phone_e164_idx
  on public.speak_profiles (phone_e164);

alter table public.speak_profiles enable row level security;
alter table public.app_calls enable row level security;

revoke all on public.speak_profiles from anon;
revoke all on public.app_calls from anon;

grant select, insert, update
on public.speak_profiles
to authenticated;

grant select, insert, update
on public.app_calls
to authenticated;

drop policy if exists "Users read own Speak profile"
on public.speak_profiles;

create policy "Users read own Speak profile"
on public.speak_profiles
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users create own Speak profile"
on public.speak_profiles;

create policy "Users create own Speak profile"
on public.speak_profiles
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Users update own Speak profile"
on public.speak_profiles;

create policy "Users update own Speak profile"
on public.speak_profiles
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Call participants read calls"
on public.app_calls;

create policy "Call participants read calls"
on public.app_calls
for select
to authenticated
using (
  caller_id = (select auth.uid())
  or callee_id = (select auth.uid())
);

drop policy if exists "Caller creates call"
on public.app_calls;

create policy "Caller creates call"
on public.app_calls
for insert
to authenticated
with check (
  caller_id = (select auth.uid())
  and status = 'ringing'
);

drop policy if exists "Call participants update calls"
on public.app_calls;

create policy "Call participants update calls"
on public.app_calls
for update
to authenticated
using (
  caller_id = (select auth.uid())
  or callee_id = (select auth.uid())
)
with check (
  caller_id = (select auth.uid())
  or callee_id = (select auth.uid())
);

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

do $$
begin
  alter publication supabase_realtime
    add table public.app_calls;
exception
  when duplicate_object then null;
end
$$;