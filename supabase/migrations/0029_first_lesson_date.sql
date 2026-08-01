-- 첫수업일 — 신규 학생이 실제로 수업을 시작한 날. 이 날짜가 있으면 그
-- 이전 주차는 밀림(clinic backlog) 집계와 성실도 티어 산정에서 제외한다.
-- students.created_at은 벌크 이관 시각이 찍혀 있어 등록일로 쓸 수 없어서
-- 별도 컬럼이 필요했다(clinicBacklog.ts 주석 참고).
-- 비워두면 기존과 똑같이 동작한다(전체 주차 대상).
alter table students add column first_lesson_date date;
