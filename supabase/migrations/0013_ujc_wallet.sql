-- 유종코인(UJC) 지갑 — 적립/차감 원장(ledger) 방식. 잔고는 학생별
-- amount 합계로 계산하며 별도 캐시 컬럼을 두지 않는다.

create table ujc_transactions (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  amount integer not null,
  reason_type text not null check (reason_type in ('clinic_complete', 'manual_grant', 'exchange', 'reset')),
  reason_note text,
  related_week_start date,
  created_by bigint references staff(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_ujc_tx_student on ujc_transactions (student_id);
-- 같은 학생의 같은 주 클리닉 완료 적립은 한 번만 (중복 적립 방지).
create unique index idx_ujc_tx_clinic_complete_unique on ujc_transactions (student_id, related_week_start)
  where reason_type = 'clinic_complete';
alter table ujc_transactions enable row level security;

create table ujc_exchange_requests (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  amount integer not null check (amount in (10, 20, 30)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  resolved_by bigint references staff(id) on delete set null,
  resolved_at timestamptz
);
create index idx_ujc_exchange_student on ujc_exchange_requests (student_id);
alter table ujc_exchange_requests enable row level security;
