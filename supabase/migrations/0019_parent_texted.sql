-- 2학기 전까지 임시로 쓰는 "학부모 문자 전송 확인" 체크 — 2학기부터 문자
-- 대신 앱으로 안내하게 되면 이 컬럼과 관련 UI는 통째로 제거할 예정이라
-- 별도 테이블 없이 attendance_records에 컬럼 하나만 얹는다.
alter table attendance_records add column parent_texted boolean not null default false;
