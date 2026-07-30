-- 클리닉 테스트 자동채점(OMR) — 종주T가 반/주차/테스트칸별 정답을 입력해두면
-- 학생이 폰으로 마킹 후 제출 시 즉시 채점되어 기존 clinic_checks.test_scores에
-- 반영된다. round은 재시험(2차까지) 확장을 위해 미리 넣어두지만 이번 구현에서는
-- 항상 1로 고정 — 재시험 자체(자동 판정/2차 응시)는 학기 중 필요해지면 별도로 만든다.
create table clinic_answer_keys (
  id bigserial primary key,
  class_key text not null,
  week_start date not null,
  test_index smallint not null check (test_index between 0 and 3),
  round smallint not null default 1,
  answers text[] not null,
  updated_at timestamptz not null default now(),
  unique (class_key, week_start, test_index, round)
);
alter table clinic_answer_keys enable row level security;

create table clinic_omr_submissions (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  week_start date not null,
  test_index smallint not null check (test_index between 0 and 3),
  round smallint not null default 1,
  answers text[] not null,
  score int not null,
  total int not null,
  submitted_at timestamptz not null default now(),
  unique (student_id, week_start, test_index, round)
);
alter table clinic_omr_submissions enable row level security;
