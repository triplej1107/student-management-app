-- 클리닉 출결 상태 명칭 변경: '연기' -> '조정' (표시 문구뿐 아니라 저장값
-- 자체가 문자열이라 기존 row도 함께 바꿔줘야 함).

update attendance_records set status = '조정' where status = '연기';
