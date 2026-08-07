-- 타이머를 학생 계정에 붙인다.
--
-- 지금까지는 student_name(글자)만 들고 있어서, 학생 화면에 남은 시간 배너를
-- 띄울 때 이름을 맞춰볼 수밖에 없었다. 조교가 자동완성 목록에서 고르지 않고
-- 직접 치다 오타를 내면 그 학생 화면에 아무것도 안 뜨고(조용한 실패),
-- 동명이인이면 엉뚱한 학생에게도 같이 떴다.
--
-- student_id가 있으면 그걸로 정확히 찾는다. 다만 조교가 명단에 없는 이름을
-- 그냥 칠 수도 있어서(외부생 등) null을 허용하고, 그때는 예전처럼 이름으로
-- 맞춘다. 학생이 퇴원해 삭제돼도 타이머 자체는 남아야 하므로 set null.
alter table exam_timers
  add column if not exists student_id bigint references students(id) on delete set null;

-- 학생 화면이 "내 타이머"를 찾을 때 쓰는 경로.
create index if not exists exam_timers_student_idx on exam_timers (student_id);

-- 이미 올라와 있는 타이머 메우기 — 이름이 정확히 한 명에게만 맞을 때만.
-- 두 명 이상이면 누구인지 알 수 없으니 건드리지 않고 이름 대조로 남겨둔다.
-- (타이머는 그날 것만 쓰이므로 안 메워져도 다음 날이면 무의미해진다.)
update exam_timers t
set student_id = s.id
from students s
where t.student_id is null
  and replace(s.name, ' ', '') = replace(t.student_name, ' ', '')
  and (
    select count(*)
    from students s2
    where replace(s2.name, ' ', '') = replace(t.student_name, ' ', '')
  ) = 1;
