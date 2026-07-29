-- UJC 마켓 — 학생이 UJC를 모바일 금액권으로 교환 신청. 신청 즉시
-- 코인이 차감되고(구 방식과 달리 승인 시점 아님), 원장이 카카오톡으로
-- 실물 선물을 수동 발송한 뒤 "발송 완료" 처리한다.

alter table ujc_exchange_requests add column brand_name text;
alter table ujc_exchange_requests add column price_value integer;

-- '코인 차감'과 '신청 내역 생성'을 하나의 트랜잭션으로 묶기 위한 함수.
-- plpgsql 함수는 기본적으로 단일 트랜잭션 안에서 실행되므로, 이 함수
-- 안에서 실패(raise exception)하면 두 insert 모두 롤백된다.
create or replace function request_ujc_exchange(
  p_student_id bigint,
  p_amount integer,
  p_brand_name text,
  p_price_value integer
) returns bigint
language plpgsql
as $$
declare
  v_balance integer;
  v_request_id bigint;
begin
  select coalesce(sum(amount), 0) into v_balance
  from ujc_transactions
  where student_id = p_student_id;

  if v_balance < p_amount then
    raise exception 'insufficient_balance';
  end if;

  insert into ujc_transactions (student_id, amount, reason_type, reason_note)
  values (p_student_id, -p_amount, 'exchange', p_brand_name || ' ' || p_price_value || '원권 교환 신청');

  insert into ujc_exchange_requests (student_id, amount, status, brand_name, price_value)
  values (p_student_id, p_amount, 'pending', p_brand_name, p_price_value)
  returning id into v_request_id;

  return v_request_id;
end;
$$;
