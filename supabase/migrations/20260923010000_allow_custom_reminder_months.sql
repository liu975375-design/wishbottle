-- Allow Custom Date reminders while preserving the existing Reminder Engine.
-- reminder_months = 0 is the explicit Custom Date marker.

alter table public.wish_reminders
  drop constraint if exists wish_reminders_months_check;

alter table public.wish_reminders
  add constraint wish_reminders_months_check
  check (reminder_months in (0, 1, 3, 6, 12));

comment on column public.wish_reminders.reminder_months is
  'Reminder interval in months. 0 means a user-selected Custom Date.';
