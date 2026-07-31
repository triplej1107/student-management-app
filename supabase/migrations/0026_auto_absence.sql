-- 밤 10시까지 미출석·미조정인 학생을 시스템이 자동으로 결석 처리할 때
-- 표시해두는 플래그. 조교/종주T가 직접 출결 버튼을 누르면(setAttendance)
-- 항상 false로 되돌아간다 — 사람이 확인·정정했다는 뜻이므로.
alter table attendance_records add column auto_marked boolean not null default false;
