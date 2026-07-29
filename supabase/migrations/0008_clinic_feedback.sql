-- 조교가 태그만 선택하면 AI가 문장으로 다듬어주는 주간 태도 피드백.
-- 클리닉 점검표(clinic_checks)에 얹어서 매주 자연스럽게 반복 입력되도록 함.
-- 학부모만 볼 수 있고 학생에게는 노출하지 않음 (앱 레이어에서 role로 분기).

alter table clinic_checks add column feedback_tags jsonb;
alter table clinic_checks add column feedback_text text;
alter table clinic_checks add column feedback_updated_at timestamptz;
