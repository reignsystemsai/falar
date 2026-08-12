create table if not exists public.saved_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  phone_numbers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_name text,
  phone_number text not null,
  status text not null default 'requested' check (
    status in ('requested', 'active', 'ended', 'failed', 'cancelled')
  ),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  ended_at timestamptz,
  ended_reason text
);

alter table public.saved_contacts enable row level security;
alter table public.call_sessions enable row level security;

revoke all on public.saved_contacts from anon;
revoke all on public.call_sessions from anon;

grant select, insert, update, delete on public.saved_contacts to authenticated;
grant select, insert, update, delete on public.call_sessions to authenticated;

drop policy if exists "Users own saved contacts" on public.saved_contacts;
create policy "Users own saved contacts"
on public.saved_contacts
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users own call sessions" on public.call_sessions;
create policy "Users own call sessions"
on public.call_sessions
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);