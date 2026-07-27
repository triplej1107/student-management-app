-- Tracks when a student was withdrawn (enrolled -> false) and auto-purges
-- their record (personal info + cascaded attendance/clinic/makeup history)
-- 3 years after withdrawal via a daily pg_cron job. Students who were
-- already withdrawn before this migration have no known withdrawal date,
-- so withdrawn_at stays null for them and they are NOT auto-deleted —
-- re-toggle 재원/퇴원 on those students (or edit them) to start the clock.

alter table students add column if not exists withdrawn_at timestamptz;

create extension if not exists pg_cron;

select cron.schedule(
  'purge-withdrawn-students-3y',
  '0 19 * * *', -- daily at 19:00 UTC = 04:00 KST
  $$
  delete from students
  where enrolled = false
    and withdrawn_at is not null
    and withdrawn_at <= now() - interval '3 years';
  $$
);
