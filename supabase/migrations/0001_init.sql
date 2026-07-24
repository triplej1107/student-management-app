-- 유종의미 국어학원 학생관리 앱 — initial schema
-- All tables are accessed only via the server (service role key). RLS is
-- enabled with no policies so the anon/authenticated keys can never read or
-- write these tables even if accidentally exposed to the client.

-- ============================================================
-- students
-- Roster columns are owned by the Google Sheet sync (upserted by
-- student_code). App-owned columns (class_key, book checkboxes, status,
-- note_to_next_ta, overrides) are never touched by the sync job.
-- ============================================================
create table students (
  id bigserial primary key,
  student_code text unique not null, -- 학번, 5-digit 등원/하원 코드
  name text not null,
  nickname text,
  enrolled boolean not null default true,
  level text, -- 고등 / 중등
  school text,
  grade text,
  parent_phone text,
  student_phone text,
  class_day text,
  class_time text,
  clinic_day text,
  clinic_time text,

  -- roster-sourced score fields (overwritten by sheet sync)
  final_score_label text,
  mid_mock_score numeric,
  mid_score numeric,
  mid_rank integer,
  final_comp_score numeric,
  final_comp_rank integer,
  mock3_label text,

  -- app-owned fields (sync never writes these)
  class_key text, -- 배명고1 / 배명고2 / 가락고1 / 예비고1 — defaults via heuristic on first import, admin-editable after
  main_book boolean not null default false,
  hw_book boolean not null default false,
  mgmt_book boolean not null default false,
  status text not null default '',
  note_to_next_ta text not null default '',
  -- admin overrides for roster-sourced score fields; takes precedence over
  -- the synced columns above so re-syncing the sheet never clobbers a manual edit.
  -- shape: { midScore?, midRank?, finalCompScore?, finalCompRank?, mock3Label? }
  overrides jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table students enable row level security;

-- ============================================================
-- staff (조교) — accounts provisioned only by 종주T, no self-signup
-- ============================================================
create table staff (
  id bigserial primary key,
  name text not null,
  work_days text[] not null default '{}', -- subset of 월화수목금토일
  work_time text,
  work_period text,
  note text,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);
alter table staff enable row level security;

-- ============================================================
-- admin_config — single shared 종주T password (hashed)
-- ============================================================
create table admin_config (
  id integer primary key default 1 check (id = 1),
  password_hash text not null
);
alter table admin_config enable row level security;

-- ============================================================
-- attendance
-- ============================================================
create table attendance_records (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  session_date date not null,
  status text not null check (status in ('출석', '지각', '결석')),
  marked_by bigint references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, session_date)
);
alter table attendance_records enable row level security;

create table makeup_schedules (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  session_date date not null, -- the original clinic date this makeup applies to
  makeup_day text not null,
  makeup_time text not null,
  created_at timestamptz not null default now(),
  unique (student_id, session_date)
);
alter table makeup_schedules enable row level security;

-- ============================================================
-- clinic checklist ("클리닉 점검표")
-- week_start is the Monday of the ISO week — real calendar dates, not the
-- prototype's relative w1..w8 slots, so past weeks stay stable regardless
-- of when they're viewed. The UI computes a rolling 8-week window
-- (this week back 7) from the current date.
-- ============================================================
create table clinic_templates (
  id bigserial primary key,
  class_key text not null, -- 배명고1 / 배명고2 / 가락고1 / 예비고1
  week_start date not null,
  month text not null default '',
  round text not null default '',
  hw_labels text[] not null default '{"","","","","","",""}', -- 7 slots
  test_labels text[] not null default '{"","","",""}', -- 4 slots
  updated_at timestamptz not null default now(),
  unique (class_key, week_start)
);
alter table clinic_templates enable row level security;

create table clinic_checks (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  week_start date not null,
  hw_checks boolean[] not null default '{f,f,f,f,f,f,f}', -- 7 slots
  test_scores jsonb not null default '[{}, {}, {}, {}]'::jsonb, -- 4 x {score, total}
  updated_at timestamptz not null default now(),
  unique (student_id, week_start)
);
alter table clinic_checks enable row level security;

-- ============================================================
-- notices ("공지사항")
-- ============================================================
create table notices (
  id bigserial primary key,
  class_key text not null,
  title text not null,
  notice_date date not null default current_date,
  tag text not null default '',
  content text not null default '',
  created_at timestamptz not null default now()
);
alter table notices enable row level security;

-- ============================================================
-- duty checklist ("요일별 체크리스트") — shared item list, per-staff per-day check state
-- ============================================================
create table duty_items (
  id bigserial primary key,
  label text not null,
  sort_order integer not null default 0
);
alter table duty_items enable row level security;

create table duty_checks (
  id bigserial primary key,
  staff_id bigint not null references staff(id) on delete cascade,
  item_id bigint not null references duty_items(id) on delete cascade,
  check_date date not null default current_date,
  checked boolean not null default true,
  unique (staff_id, item_id, check_date)
);
alter table duty_checks enable row level security;

create index idx_attendance_student_date on attendance_records (student_id, session_date);
create index idx_clinic_checks_week on clinic_checks (week_start);
create index idx_clinic_templates_class_week on clinic_templates (class_key, week_start);
create index idx_notices_class on notices (class_key, notice_date desc);
create index idx_duty_checks_staff_date on duty_checks (staff_id, check_date);
create index idx_students_class_key on students (class_key);
