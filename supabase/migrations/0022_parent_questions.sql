-- 학부모가 종주T에게 남기는 질문 + 종주T의 답변. week_start는 수요일
-- 00시를 기준으로 나뉘는 "질문 주"(wednesdayOf) — 주가 바뀌면 학부모 화면의
-- 질문 칸이 자동으로 비워진다(과거 질문·답변은 기록으로 남지만 화면엔 그
-- 주의 row만 보여준다). 학부모가 너무 잦은 질문을 남기지 않도록 하기 위함.
create table parent_questions (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  week_start date not null,
  question_text text not null,
  answer_text text,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, week_start)
);
alter table parent_questions enable row level security;

-- 종주T도 웹 푸시(학부모 질문 도착 알림)를 받을 수 있도록 push_subscriptions를
-- 확장 — student_id/staff_id 둘 다 없는 대신 is_zongju로 표시한다(종주T는
-- staff/students 테이블에 자기 row가 없는 단일 관리자 로그인이라서).
alter table push_subscriptions add column is_zongju boolean not null default false;
alter table push_subscriptions drop constraint push_subscriptions_owner_check;
alter table push_subscriptions add constraint push_subscriptions_owner_check
  check (
    (case when student_id is not null then 1 else 0 end) +
    (case when staff_id is not null then 1 else 0 end) +
    (case when is_zongju then 1 else 0 end) = 1
  );
