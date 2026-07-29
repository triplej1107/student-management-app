-- 클리닉 출결 상태 명칭 변경: '연기' -> '조정' (표시 문구뿐 아니라 저장값
-- 자체가 문자열이라 기존 row도 함께 바꿔줘야 함).
-- check 제약이 여전히 '연기'만 허용하고 있어 새 값 '조정'을 먼저
-- 허용하도록 제약을 바꾼 뒤에 기존 row를 업데이트해야 한다.

alter table attendance_records drop constraint attendance_records_status_check;
alter table attendance_records add constraint attendance_records_status_check
  check (status in ('출석', '지각', '조정', '결석'));

update attendance_records set status = '조정' where status = '연기';
