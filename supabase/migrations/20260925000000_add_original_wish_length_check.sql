-- Enforce the public Original Wish limit for new and updated rows without
-- rejecting or modifying existing legacy data.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'wishes_wish_content_max_length'
      and conrelid = 'public.wishes'::regclass
  ) then
    alter table public.wishes
      add constraint wishes_wish_content_max_length
      check (char_length(wish_content) <= 80)
      not valid;
  end if;
end
$$;
