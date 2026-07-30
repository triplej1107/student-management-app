-- 요일별 업무 체크리스트 현황에 "그날만 대타로 온 조교"를 추가로 표시하기
-- 위한 테이블. 대타 본인은 자기 계정으로 정상적으로 체크리스트를 완료하면
-- 되고(work_days와 무관하게 duty_checks는 이미 날짜+조교 기준), 이 테이블은
-- 종주T 홈 화면에 그 조교를 그날 목록에 추가로 보여주기 위한 표시용이다.

create table duty_substitutes (
  id bigserial primary key,
  check_date date not null,
  staff_id bigint not null references staff(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (check_date, staff_id)
);
create index idx_duty_substitutes_date on duty_substitutes (check_date);
alter table duty_substitutes enable row level security;
