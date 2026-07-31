-- "잊지마" — 조교/종주T가 직접 입력하는 돌발 일정(보강, 교재 픽업, 학부모
-- 방문상담 등) 알림. day_before_pushed_at/hour_before_pushed_at은 각 알림을
-- 실제로 보냈는지 표시해 중복 발송을 막는다.
create table reminders (
  id bigserial primary key,
  event_date date not null,
  event_time text not null, -- "HH:MM"
  content text not null,
  day_before_pushed_at timestamptz,
  hour_before_pushed_at timestamptz,
  resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table reminders enable row level security;

create index reminders_event_date_idx on reminders (event_date) where not resolved;
