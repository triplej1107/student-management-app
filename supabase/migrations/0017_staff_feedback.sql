-- 조교 피드백(종주T가 특정 조교에게 남기는 한마디) + 조교도 웹 푸시
-- 구독할 수 있도록 push_subscriptions를 학생 전용에서 학생/조교 공용으로 확장.

alter table push_subscriptions alter column student_id drop not null;
alter table push_subscriptions add column staff_id bigint references staff(id) on delete cascade;
alter table push_subscriptions add constraint push_subscriptions_owner_check
  check ((student_id is not null) <> (staff_id is not null));

create table staff_feedback_messages (
  id bigserial primary key,
  staff_id bigint not null references staff(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index idx_staff_feedback_staff on staff_feedback_messages (staff_id);
alter table staff_feedback_messages enable row level security;
