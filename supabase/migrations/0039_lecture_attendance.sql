-- 주말 강의(정규 수업) 출결.
--
-- 클리닉 출결(attendance_records)과 왜 테이블을 나눴나: 그쪽은
-- unique(student_id, session_date)라 하루에 한 건만 들어간다. 같은 날 강의와
-- 클리닉이 둘 다 있는 학생이 있어서 한 테이블에 담으면 서로 덮어쓴다.
--
-- 이 표의 출처는 기본적으로 맥가이7 키오스크다. 앱이 맥가이7 화면에서
-- 등원 명단을 읽어와 채우고(source='macgai7'), 조교·종주T가 직접 고친 건
-- source='manual'로 남겨 다음 동기화가 덮어쓰지 않게 한다.
create table if not exists lecture_attendance (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  session_date date not null,
  status text not null check (status in ('출석', '지각', '결석')),
  -- 키오스크에 찍힌 등원 시각. 결석이면 비어 있다.
  checked_in_at timestamptz,
  -- 'macgai7' = 자동으로 들어온 것, 'manual' = 사람이 고친 것.
  source text not null default 'macgai7' check (source in ('macgai7', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, session_date)
);
alter table lecture_attendance enable row level security;

create index if not exists lecture_attendance_date_idx on lecture_attendance (session_date);
create index if not exists lecture_attendance_student_idx on lecture_attendance (student_id, session_date);

-- 그 주만 강의 시간을 옮긴 학생 — 클리닉의 makeup_schedules와 같은 구조다.
--
-- session_date는 "원래 수업일"이고 목적지는 moved_day/moved_time에 들어간다.
-- 그래서 옮긴 학생은 원래 날짜 명단에서 빠지고 옮겨간 날짜 명단에 들어간다.
-- 한 주짜리 임시 변경이라 그 주가 지나면 저절로 원래 시간으로 돌아간다
-- (학생의 class_day/class_time은 건드리지 않는다).
create table if not exists lecture_overrides (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  session_date date not null,
  moved_day text not null,
  moved_time text not null,
  -- 사유/전달사항. 조교끼리 보는 내용이라 학생·학부모에게는 안 보낸다.
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, session_date)
);
alter table lecture_overrides enable row level security;

create index if not exists lecture_overrides_date_idx on lecture_overrides (session_date);

-- 동기화가 살아있는지 지켜보는 기록.
--
-- 맥가이7이 화면을 개편하면 긁어오기가 조용히 멈춘다. 그때 아무도 모르는
-- 게 가장 위험하므로, 성공/실패를 매번 남기고 "몇 시간째 성공이 없으면"
-- 종주T에게 알린다.
create table if not exists macgai_sync_log (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  ok boolean not null,
  -- 읽어온 등원 건수 (성공일 때).
  fetched_count int,
  -- 실패 사유 한 줄 — 무엇이 깨졌는지 사람이 보고 판단할 수 있게.
  error text
);
alter table macgai_sync_log enable row level security;

create index if not exists macgai_sync_log_ran_idx on macgai_sync_log (ran_at desc);
