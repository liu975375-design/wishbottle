-- Release 0: Wish storage.
-- The service role is the only writer/reader used by the Next.js server.
-- Public/anon clients have no direct table access.

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  wish_code text not null,
  wish_content text not null,
  pin_hash text not null,
  contact_email text,
  contact_type text,
  reminder_date date,
  reminder_status text,
  source text,
  event_id text,
  journey_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wishes_wish_code_key unique (wish_code),
  constraint wishes_wish_code_not_blank check (length(btrim(wish_code)) > 0),
  constraint wishes_wish_content_not_blank check (length(btrim(wish_content)) > 0),
  constraint wishes_pin_hash_not_blank check (length(pin_hash) > 0)
);

comment on table public.wishes is
  'Release 0 wish records. wish_code is a lookup code; id is the stable internal identity.';

comment on column public.wishes.pin_hash is
  'Encoded scrypt hash containing algorithm parameters and a random salt. Never stores a plaintext PIN.';

create or replace function public.set_wishbottle_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger wishes_set_updated_at
before update on public.wishes
for each row
execute function public.set_wishbottle_updated_at();

alter table public.wishes enable row level security;

-- RLS has no public policies. These revokes provide defense in depth for
-- direct table access from browser-facing Supabase roles.
revoke all on table public.wishes from anon, authenticated;
grant select, insert, update, delete on table public.wishes to service_role;
