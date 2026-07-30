-- 학생 생일 필드 + 생일 당일 UJC 자동 지급을 위한 reason_type 확장.
-- 매년 중복 지급을 막기 위해 ujc_transactions.related_week_start 컬럼에
-- (원래 클리닉 주차용이지만) "그 해의 생일 날짜"를 저장해 clinic_complete와
-- 같은 방식으로 부분 unique 인덱스로 막는다.

alter table students add column birthday date;

alter table ujc_transactions drop constraint ujc_transactions_reason_type_check;
alter table ujc_transactions add constraint ujc_transactions_reason_type_check
  check (reason_type in ('clinic_complete', 'manual_grant', 'exchange', 'reset', 'birthday_gift'));

create unique index idx_ujc_tx_birthday_gift_unique on ujc_transactions (student_id, related_week_start)
  where reason_type = 'birthday_gift';
