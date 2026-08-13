create table if not exists public.saved_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  phone_numbers jsonb not null default '[]'::jsonb,
  source_contact_id text,
  normalized_phone_numbers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.saved_contacts
  add column if not exists source_contact_id text,
  add column if not exists normalized_phone_numbers jsonb not null default '[]'::jsonb;

create unique index if not exists saved_contacts_user_source_unique_idx
  on public.saved_contacts (user_id, source_contact_id)
  where source_contact_id is not null;

create index if not exists saved_contacts_user_display_name_idx
  on public.saved_contacts (user_id, display_name);

alter table public.saved_contacts enable row level security;

revoke all on public.saved_contacts from anon;

grant select, insert, update, delete on public.saved_contacts to authenticated;

drop policy if exists "Users own saved contacts" on public.saved_contacts;
create policy "Users own saved contacts"
on public.saved_contacts
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

select pg_notify('pgrst', 'reload schema');
