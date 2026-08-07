-- 강의 출결에 '조정'을 더한다 — 클리닉 출결과 같은 4가지로 맞추기 위해.
--
-- 클리닉은 출석/지각/조정/결석 네 가지고, 강의도 조교가 같은 감각으로 쓰길
-- 원해서 맞춘다. 맥가이7 동기화는 여전히 출석/지각/결석만 만들고, '조정'은
-- 사람이 직접 누를 때만 생긴다.
alter table lecture_attendance drop constraint if exists lecture_attendance_status_check;
alter table lecture_attendance add constraint lecture_attendance_status_check
  check (status in ('출석', '지각', '조정', '결석'));

-- 보강 일정은 lecture_overrides를 그대로 쓴다(클리닉이 makeup_schedules를
-- 조정·보강 양쪽에 쓰는 것과 같다). 다만 강의는 그 주 안에서만 옮기는 게
-- 아니라 다음 주로 넘겨 보강하는 경우가 있어서, 옮겨간 "날짜"를 직접 적을 수
-- 있게 한 칸 더 둔다. 비어 있으면 예전처럼 같은 주 안에서 요일로 찾는다.
alter table lecture_overrides
  add column if not exists moved_date date;

comment on column lecture_overrides.moved_date is
  '보강이 다음 주로 넘어갈 때 쓰는 실제 날짜. 비어 있으면 같은 주 안에서 moved_day로 찾는다.';

-- 나중에 클리닉 출결까지 키오스크로 자동화할 때 쓸 칸. 지금 코드는 안 쓴다.
--
-- marked_by(조교 id)로 구분하면 되지 않나 싶지만, 그 칸은 조교가 누른 게
-- 아닐 때 전부 null이라 "키오스크가 찍은 것"과 "시스템이 짐작으로 찍은 자동
-- 지각"을 못 가른다. 매일 도는 동기화가 조교가 고쳐둔 걸 되돌리지 않으려면
-- 그 셋을 구분해야 해서 별도 칸을 둔다.
--
-- 기존 기록은 전부 'manual'로 들어간다 — 지금까지는 조교가 손으로 누른 것이
-- 맞으므로 정확하다.
alter table attendance_records
  add column if not exists source text not null default 'manual'
  check (source in ('manual', 'macgai7'));
