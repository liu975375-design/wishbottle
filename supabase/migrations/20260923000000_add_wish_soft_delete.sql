-- Release 2 finishing feature: soft delete for user-controlled Wish removal.
-- Reminder and Reflection history remain in place.

alter table public.wishes
  add column if not exists deleted_at timestamptz;

create index if not exists wishes_active_wish_code_idx
  on public.wishes (wish_code)
  where deleted_at is null;

create or replace function public.soft_delete_wish(p_wish_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wish_id uuid;
begin
  update public.wishes
  set deleted_at = now()
  where id = p_wish_id
    and deleted_at is null
  returning id into v_wish_id;

  if v_wish_id is null then
    return false;
  end if;

  update public.wish_reminders
  set
    status = 'cancelled',
    last_error = 'Wish deleted by user.',
    updated_at = now()
  where wish_id = p_wish_id
    and status = 'pending';

  return true;
end;
$$;

revoke all on function public.soft_delete_wish(uuid)
  from public, anon, authenticated;

grant execute on function public.soft_delete_wish(uuid)
  to service_role;
