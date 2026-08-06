-- 공지를 학생에게만 / 학부모에게만 / 둘 다에게 보낼 수 있도록.
--
-- 기존 공지는 지금까지 학생·학부모 모두에게 보이고 있었으므로 'both'가
-- 기본값이자 기존 데이터의 값이다.
alter table notices
  add column if not exists audience text not null default 'both';

alter table notices
  drop constraint if exists notices_audience_check;
alter table notices
  add constraint notices_audience_check check (audience in ('student', 'parent', 'both'));
