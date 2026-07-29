-- 종주T가 직접 쓰는 별도 주간 피드백. 조교가 AI로 다듬는 feedback_text와
-- 달리 결재 게이트 없이 작성 즉시 학부모에게 노출된다 (종주T 본인이
-- 쓰는 것이라 별도 승인 단계가 필요 없음). 비어있으면 학부모 화면에
-- 아예 표시되지 않는다.

alter table clinic_checks add column zongju_feedback_text text;
