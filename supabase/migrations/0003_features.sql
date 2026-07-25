-- Adds: 연기(postponed) attendance status, a handoff note on makeup
-- schedules, weekly class plans (진도/클리닉/과제), and admin-authored
-- calendar day notes shown on the student/parent home calendar.

alter table attendance_records drop constraint attendance_records_status_check;
alter table attendance_records add constraint attendance_records_status_check
  check (status in ('출석', '지각', '연기', '결석'));

alter table makeup_schedules add column note text;

create table class_plans (
  id bigserial primary key,
  class_key text not null,
  week_start date not null,
  progress_content text not null default '',
  clinic_content text not null default '',
  homework_content text not null default '',
  updated_at timestamptz not null default now(),
  unique (class_key, week_start)
);
alter table class_plans enable row level security;

create table calendar_notes (
  id bigserial primary key,
  note_date date not null,
  class_key text, -- null = 전체 반에 표시
  content text not null default '',
  created_at timestamptz not null default now()
);
alter table calendar_notes enable row level security;

create index idx_class_plans_class_week on class_plans (class_key, week_start);
create index idx_calendar_notes_date on calendar_notes (note_date);
