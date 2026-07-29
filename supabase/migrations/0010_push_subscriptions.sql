-- 클리닉 1주 밀림 자동 웹 푸시 발송용 구독 정보.
-- 학생이 로그인 후 브라우저 알림을 허용하면 이 테이블에 구독 정보가
-- 저장된다. 같은 학생이 여러 기기(폰/PC)에서 구독하면 여러 row가 생길
-- 수 있으므로 student_id 기준 unique 제약은 걸지 않는다.

create table push_subscriptions (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
