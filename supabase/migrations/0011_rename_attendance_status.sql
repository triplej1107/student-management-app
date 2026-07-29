-- 클리닉 출결 상태 명칭 변경: '연기' -> '조정' (표시 문구뿐 아니라 저장값
-- 자체가 문자열이라 기존 row도 함께 바꿔줘야 함).
-- check 제약이 '연기'/'조정' 둘 다 아직 안 걸려있으면 update 자체가
-- 막히고, 반대로 '조정'만 허용하는 제약을 먼저 걸면 아직 '연기'인
-- row들 때문에 제약 추가 자체가 실패한다 (add constraint가 기존 row를
-- 즉시 검증함) — 그래서 제약을 완전히 뺀 상태로 update부터 하고,
-- 그 다음에 새 제약을 건다.

alter table attendance_records drop constraint attendance_records_status_check;

update attendance_records set status = '조정' where status = '연기';

alter table attendance_records add constraint attendance_records_status_check
  check (status in ('출석', '지각', '조정', '결석'));
