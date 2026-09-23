-- Release 2: multiple reminders, one-time return tokens, reflections, and
-- atomic Wish + Reminder creation.

alter table public.wishes
  add column if not exists idempotency_key text;

create unique index if not exists wishes_idempotency_key_key
  on public.wishes (idempotency_key)
  where idempotency_key is not null;

create table if not exists public.wish_reminders (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.wishes(id) on delete cascade,
  reminder_months integer not null,
  reminder_date date not null,
  scheduled_at timestamptz not null,
  status text not null default 'pending',
  sent_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wish_reminders_months_check
    check (reminder_months in (1, 3, 6, 12)),
  constraint wish_reminders_status_check
    check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  constraint wish_reminders_attempt_count_check
    check (attempt_count >= 0),
  constraint wish_reminders_unique_cycle
    unique (wish_id, reminder_months, reminder_date)
);

create index if not exists wish_reminders_due_idx
  on public.wish_reminders (status, scheduled_at);

create index if not exists wish_reminders_wish_id_idx
  on public.wish_reminders (wish_id, created_at);

create table if not exists public.wish_reflections (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.wishes(id) on delete cascade,
  reminder_id uuid references public.wish_reminders(id) on delete set null,
  response_type text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wish_reflections_response_type_check
    check (response_type in ('nothing_changed', 'something_changed', 'future_note', 'remind_later'))
);

create index if not exists wish_reflections_wish_id_idx
  on public.wish_reflections (wish_id, created_at desc);

create table if not exists public.wish_return_tokens (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.wishes(id) on delete cascade,
  reminder_id uuid references public.wish_reminders(id) on delete set null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wish_return_tokens_wish_id_idx
  on public.wish_return_tokens (wish_id, created_at desc);

drop trigger if exists wish_reminders_set_updated_at on public.wish_reminders;
create trigger wish_reminders_set_updated_at
before update on public.wish_reminders
for each row
execute function public.set_wishbottle_updated_at();

drop trigger if exists wish_reflections_set_updated_at on public.wish_reflections;
create trigger wish_reflections_set_updated_at
before update on public.wish_reflections
for each row
execute function public.set_wishbottle_updated_at();

alter table public.wish_reminders enable row level security;
alter table public.wish_reflections enable row level security;
alter table public.wish_return_tokens enable row level security;

revoke all on table public.wish_reminders from anon, authenticated;
revoke all on table public.wish_reflections from anon, authenticated;
revoke all on table public.wish_return_tokens from anon, authenticated;
grant select, insert, update, delete on table public.wish_reminders to service_role;
grant select, insert, update, delete on table public.wish_reflections to service_role;
grant select, insert, update, delete on table public.wish_return_tokens to service_role;

create or replace function public.create_wish_with_reminders(
  p_idempotency_key text,
  p_wish_code text,
  p_wish_content text,
  p_pin_hash text,
  p_name text,
  p_contact_type text,
  p_contact_email text,
  p_legacy_reminder_date date,
  p_reminders jsonb
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
    where r.status = 'pending'
      and r.scheduled_at <= now()
    order by r.scheduled_at, r.created_at
    for update skip locked
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

create or replace function public.save_wish_reflection(
  p_wish_id uuid,
  p_reminder_id uuid,
  p_response_type text,
  p_note text,
  p_wish_content text,
  p_new_reminder jsonb default null
)
returns setof public.wish_reflections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reflection_id uuid;
begin
  if p_wish_content is not null and btrim(p_wish_content) <> '' then
    update public.wishes
    set wish_content = p_wish_content
    where id = p_wish_id;

    if not found then
      raise exception 'Wish not found';
    end if;
  end if;

  insert into public.wish_reflections (
    wish_id,
    reminder_id,
    response_type,
    note
  )
  values (
    p_wish_id,
    p_reminder_id,
    p_response_type,
    nullif(btrim(p_note), '')
  )
  returning id into v_reflection_id;

  if p_response_type = 'remind_later' and p_new_reminder is not null then
    insert into public.wish_reminders (
      wish_id,
      reminder_months,
      reminder_date,
      scheduled_at,
      status
    )
    values (
      p_wish_id,
      (p_new_reminder ->> 'months')::integer,
      (p_new_reminder ->> 'reminderDate')::date,
      (p_new_reminder ->> 'scheduledAt')::timestamptz,
      'pending'
    );
  end if;

  return query
    select r.*
    from public.wish_reflections r
    where r.id = v_reflection_id;
end;
$$;

revoke all on function public.create_wish_with_reminders(
  text, text, text, text, text, text, text, date, jsonb
) from public, anon, authenticated;

revoke all on function public.claim_due_wish_reminders(integer)
  from public, anon, authenticated;

revoke all on function public.save_wish_reflection(
  uuid, uuid, text, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.create_wish_with_reminders(
  text, text, text, text, text, text, text, date, jsonb
) to service_role;

grant execute on function public.claim_due_wish_reminders(integer)
  to service_role;

grant execute on function public.save_wish_reflection(
  uuid, uuid, text, text, text, jsonb
) to service_role;

