-- Adds TA sign-off ("조교 결재") and 종주T final sign-off ("종주T 최종 결재")
-- tracking to each student's weekly clinic checklist.

alter table clinic_checks
  add column staff_approved boolean not null default false,
  add column staff_approved_by bigint references staff(id) on delete set null,
  add column staff_approved_at timestamptz,
  add column zongju_approved boolean not null default false,
  add column zongju_approved_at timestamptz;
