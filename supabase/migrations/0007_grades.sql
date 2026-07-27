-- 내신(학교 시험) 및 모의고사 성적 기록. exam_key is a fixed code for
-- each exam slot (see SCHOOL_EXAMS / MOCK_EXAMS in src/lib/types.ts) —
-- one row per student per slot, upserted as scores come in.

create table school_exams (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  exam_key text not null,
  score numeric,
  rank integer,
  grade integer,
  note text,
  updated_at timestamptz not null default now(),
  unique (student_id, exam_key)
);
alter table school_exams enable row level security;
create index idx_school_exams_student on school_exams (student_id);

create table mock_exams (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  exam_key text not null,
  score numeric,
  percentile numeric,
  grade integer,
  note text,
  updated_at timestamptz not null default now(),
  unique (student_id, exam_key)
);
alter table mock_exams enable row level security;
create index idx_mock_exams_student on mock_exams (student_id);
