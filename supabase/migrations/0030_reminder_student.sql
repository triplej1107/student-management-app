-- "잊지마"를 특정 학생과 연결 — 대부분의 돌발 일정(보강, 밀린 클리닉,
-- 교재 픽업)이 특정 학생 건이라, 연결해두면 그 학생·학부모에게도 알림이
-- 가고 학생 홈 화면에도 표시된다. 비워두면 기존처럼 조교·종주T 전용.
-- 학생이 삭제돼도 일정 자체는 남기고 연결만 끊는다.
alter table reminders
  add column student_id bigint references students(id) on delete set null;

create index reminders_student_idx on reminders (student_id) where not resolved;
