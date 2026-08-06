-- 클리닉 시간에 학생들이 보는 모의고사 타이머.
--
-- 조교 홈 화면에 이름·시작시간·남은시간만 딱 보이는 카드로 뜬다. 여러 조교가
-- 같은 판을 보므로 기기별 저장이 아니라 DB에 둔다.
--
-- 진행 중이면 paused_remaining_seconds가 null이고 남은 시간은
-- start_at + duration_seconds에서 계산한다. 정지를 누르면 그 순간의 남은
-- 시간을 paused_remaining_seconds에 박아두고, 다시 시작하면 그 값만큼
-- 남도록 start_at을 새로 잡는다(examTimerRules.ts 참고).
create table if not exists exam_timers (
  id bigserial primary key,
  student_name text not null,
  -- "모의고사 4회차" 같은 시험 이름 — 10분 전 알림 문구에 들어간다. 비워도 됨.
  exam_label text,
  duration_seconds int not null check (duration_seconds > 0),
  start_at timestamptz not null,
  paused_remaining_seconds int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table exam_timers enable row level security;

-- 홈 화면은 "오늘 만든 것"만 불러온다 — 날이 바뀌면 판이 저절로 비워진다.
create index if not exists exam_timers_created_idx on exam_timers (created_at);
