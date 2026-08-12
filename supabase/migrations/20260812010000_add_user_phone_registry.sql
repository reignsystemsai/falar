create table if not exists public.user_phone_numbers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.user_phone_numbers enable row level security;

create policy "phone_registry_read_authenticated"
on public.user_phone_numbers
for select
using (auth.role() = 'authenticated');

create policy "phone_registry_upsert_own"
on public.user_phone_numbers
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
