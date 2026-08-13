create table if not exists public.app_calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  room_name text not null unique default ('speak-' || gen_random_uuid()::text),
  status text not null default 'ringing'
    check (status in ('ringing', 'accepted', 'declined', 'ended', 'failed')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  constraint app_calls_not_self check (caller_id <> callee_id)
);

alter table if exists public.app_calls
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists answered_at timestamptz,
  add column if not exists ended_at timestamptz;

alter table public.app_calls enable row level security;

revoke all on public.app_calls from anon;

grant select, insert, update on public.app_calls to authenticated;

drop policy if exists "Call participants read calls" on public.app_calls;
create policy "Call participants read calls"
on public.app_calls
for select
to authenticated
using (
  caller_id = (select auth.uid())
  or callee_id = (select auth.uid())
);

drop policy if exists "Caller creates call" on public.app_calls;
create policy "Caller creates call"
on public.app_calls
for insert
to authenticated
with check (
  caller_id = (select auth.uid())
  and status = 'ringing'
);

drop policy if exists "Call participants update calls" on public.app_calls;
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

do $$
begin
  alter publication supabase_realtime
    add table public.app_calls;
exception
  when duplicate_object then null;
end
$$;
