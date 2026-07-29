-- 2주 이상 밀린 학생에 대한 원장/데스크 전화 연락 기록.
-- week_start는 "이번 밀림 관리 대시보드가 평가한 최신 클리닉 주"를 가리킨다
-- (getClinicBacklog가 매번 계산하는 마지막 평가 주 = rollingClinicWeeks(1)의
-- 그 주) — 밀림이 다음 주까지 이어지면 새 row가 생겨 다시 미확인 상태로
-- 노출되고, 지난 주 통화 메모는 히스토리로 남는다.

create table clinic_contact_logs (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  week_start date not null, -- 대시보드가 평가한 최신 클리닉 주
  contacted boolean not null default false,
  note text,
  contacted_by bigint references staff(id) on delete set null,
  contacted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (student_id, week_start)
);
alter table clinic_contact_logs enable row level security;
