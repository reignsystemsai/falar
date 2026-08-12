alter table if exists public.saved_contacts
  add column if not exists source_contact_id text,
  add column if not exists normalized_phone_numbers jsonb not null default '[]'::jsonb;

create unique index if not exists saved_contacts_user_source_unique_idx
  on public.saved_contacts (user_id, source_contact_id)
  where source_contact_id is not null;