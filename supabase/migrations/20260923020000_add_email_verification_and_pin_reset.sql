-- Phase 1: reusable verified emails, email verification tokens, and isolated
-- PIN reset tokens. Wish remains the aggregate root; no user/account model.

alter table public.wishes
  add column if not exists email_verified_at timestamptz;

create table if not exists public.verified_emails (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null unique,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.wishes(id) on delete cascade,
  email text not null,
  normalized_email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_verification_tokens_wish_idx
  on public.email_verification_tokens (wish_id, created_at desc);

create index if not exists email_verification_tokens_active_idx
  on public.email_verification_tokens (normalized_email, expires_at)
  where used_at is null;

create table if not exists public.pin_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.wishes(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint pin_reset_tokens_attempt_count_check
    check (attempt_count >= 0)
);

create index if not exists pin_reset_tokens_wish_idx
  on public.pin_reset_tokens (wish_id, created_at desc);

create index if not exists pin_reset_tokens_active_idx
  on public.pin_reset_tokens (expires_at)
  where used_at is null;

drop trigger if exists verified_emails_set_updated_at on public.verified_emails;
create trigger verified_emails_set_updated_at
before update on public.verified_emails
for each row
execute function public.set_wishbottle_updated_at();

alter table public.verified_emails enable row level security;
alter table public.email_verification_tokens enable row level security;
alter table public.pin_reset_tokens enable row level security;

revoke all on table public.verified_emails from anon, authenticated;
revoke all on table public.email_verification_tokens from anon, authenticated;
revoke all on table public.pin_reset_tokens from anon, authenticated;

grant select, insert, update, delete on table public.verified_emails to service_role;
grant select, insert, update, delete on table public.email_verification_tokens to service_role;
grant select, insert, update, delete on table public.pin_reset_tokens to service_role;

drop function if exists public.create_wish_with_reminders(
  text, text, text, text, text, text, text, date, jsonb
);

create or replace function public.create_wish_with_reminders(
  p_idempotency_key text,
  p_wish_code text,
  p_wish_content text,
  p_pin_hash text,
  p_name text,
  p_contact_type text,
  p_contact_email text,
  p_legacy_reminder_date date,
  p_reminders jsonb,
  p_email_verified_at timestamptz default null
)
returns table (
  id uuid,
  wish_code text,
  wish_content text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wish_id uuid;
  v_existing_id uuid;
  v_reminder jsonb;
begin
  if p_idempotency_key is not null then
    select w.id into v_existing_id
    from public.wishes w
    where w.idempotency_key = p_idempotency_key;

    if v_existing_id is not null then
      return query
        select w.id, w.wish_code, w.wish_content, w.created_at
        from public.wishes w
        where w.id = v_existing_id;
      return;
    end if;
  end if;

  begin
    insert into public.wishes (
      wish_code,
      wish_content,
      pin_hash,
      name,
      contact_type,
      contact_email,
      email_verified_at,
      reminder_date,
      reminder_status,
      idempotency_key
    )
    values (
      p_wish_code,
      p_wish_content,
      p_pin_hash,
      p_name,
      p_contact_type,
      p_contact_email,
      p_email_verified_at,
      p_legacy_reminder_date,
      'pending',
      p_idempotency_key
    )
    returning wishes.id into v_wish_id;
  exception when unique_violation then
    if p_idempotency_key is not null then
      select w.id into v_existing_id
      from public.wishes w
      where w.idempotency_key = p_idempotency_key;

      if v_existing_id is not null then
        return query
          select w.id, w.wish_code, w.wish_content, w.created_at
          from public.wishes w
          where w.id = v_existing_id;
        return;
      end if;
    end if;

    raise;
  end;

  for v_reminder in
    select value from jsonb_array_elements(p_reminders)
  loop
    insert into public.wish_reminders (
      wish_id,
      reminder_months,
      reminder_date,
      scheduled_at,
      status
    )
    values (
      v_wish_id,
      (v_reminder ->> 'months')::integer,
      (v_reminder ->> 'reminderDate')::date,
      (v_reminder ->> 'scheduledAt')::timestamptz,
      'pending'
    );
  end loop;

  return query
    select w.id, w.wish_code, w.wish_content, w.created_at
    from public.wishes w
    where w.id = v_wish_id;
end;
$$;

create or replace function public.verify_email_token(p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wish_id uuid;
  v_normalized_email text;
  v_verified_at timestamptz := now();
begin
  update public.email_verification_tokens t
  set used_at = v_verified_at
  where t.token_hash = p_token_hash
    and t.used_at is null
    and t.expires_at > v_verified_at
  returning t.wish_id, t.normalized_email
  into v_wish_id, v_normalized_email;

  if v_wish_id is null or v_normalized_email is null then
    return false;
  end if;

  insert into public.verified_emails (
    normalized_email,
    verified_at
  )
  values (
    v_normalized_email,
    v_verified_at
  )
  on conflict (normalized_email)
  do update set
    verified_at = excluded.verified_at,
    updated_at = now();

  update public.wishes w
  set email_verified_at = coalesce(w.email_verified_at, v_verified_at)
  where w.deleted_at is null
    and lower(btrim(w.contact_email)) = v_normalized_email;

  return true;
end;
$$;

create or replace function public.complete_pin_reset(
  p_wish_id uuid,
  p_token_hash text,
  p_pin_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_id uuid;
  v_used_at timestamptz := now();
begin
  select t.id into v_token_id
  from public.pin_reset_tokens t
  where t.wish_id = p_wish_id
    and t.token_hash = p_token_hash
    and t.used_at is null
    and t.expires_at > v_used_at
  for update;

  if v_token_id is null then
    return false;
  end if;

  update public.wishes
  set pin_hash = p_pin_hash
  where id = p_wish_id
    and deleted_at is null;

  if not found then
    return false;
  end if;

  update public.pin_reset_tokens
  set used_at = v_used_at
  where id = v_token_id;

  return true;
end;
$$;

create or replace function public.claim_due_wish_reminders(
  p_limit integer default 20
)
returns setof public.wish_reminders
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select r.id
    from public.wish_reminders r
    join public.wishes w on w.id = r.wish_id
    where r.status = 'pending'
      and r.scheduled_at <= now()
      and w.deleted_at is null
      and w.contact_email is not null
      and w.email_verified_at is not null
    order by r.scheduled_at, r.created_at
    for update of r skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.wish_reminders r
  set
    status = 'sending',
    attempt_count = r.attempt_count + 1,
    last_error = null,
    updated_at = now()
  from due
  where r.id = due.id
  returning r.*;
end;
$$;

revoke all on function public.create_wish_with_reminders(
  text, text, text, text, text, text, text, date, jsonb, timestamptz
) from public, anon, authenticated;

revoke all on function public.verify_email_token(text)
  from public, anon, authenticated;

revoke all on function public.complete_pin_reset(uuid, text, text)
  from public, anon, authenticated;

revoke all on function public.claim_due_wish_reminders(integer)
  from public, anon, authenticated;

grant execute on function public.create_wish_with_reminders(
  text, text, text, text, text, text, text, date, jsonb, timestamptz
) to service_role;

grant execute on function public.verify_email_token(text)
  to service_role;

grant execute on function public.complete_pin_reset(uuid, text, text)
  to service_role;

grant execute on function public.claim_due_wish_reminders(integer)
  to service_role;
