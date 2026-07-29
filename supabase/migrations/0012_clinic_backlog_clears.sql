-- 종주T가 특정 학생의 특정 주차 밀림을 "청산"(write-off) 처리할 수 있게
-- 하는 테이블. 실제 숙제/테스트 완료 여부(clinic_checks)는 건드리지
-- 않고, getClinicBacklog가 그 주를 밀림 계산에서 건너뛰게만 만든다
-- (예: 전학/사정으로 더 이상 추적할 필요가 없어진 경우).

create table clinic_backlog_clears (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  week_start date not null,
  cleared_by bigint references staff(id) on delete set null,
  cleared_at timestamptz not null default now(),
  unique (student_id, week_start)
);
alter table clinic_backlog_clears enable row level security;
