-- Release 1: store the name shown in the Wish Journey.
-- Existing wishes remain valid; name is nullable at the database level and
-- required by the Release 1 Create Wish API validation.

alter table public.wishes
  add column if not exists name text;

comment on column public.wishes.name is
  'Name the user chose for their Wish Journey. Contact email remains separate from Wish ownership.';

comment on table public.wishes is
  'Wish records. id is the stable internal identity; wish_code is the lookup code; email fields are contact details only.';
