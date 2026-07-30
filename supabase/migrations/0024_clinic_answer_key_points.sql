-- 모의고사처럼 문항마다 배점(2점/3점 등)이 다른 시험을 지원하기 위해
-- clinic_answer_keys에 points를 추가한다. 비워두면(기본값 '{}') 채점 시
-- 문항당 1점으로 취급 — 내신 클리닉테스트의 "맞힌 문항 수" 채점 방식과
-- 완전히 동일하게 동작해 기존 데이터/동작에 영향 없음.
alter table clinic_answer_keys add column points smallint[] not null default '{}';
