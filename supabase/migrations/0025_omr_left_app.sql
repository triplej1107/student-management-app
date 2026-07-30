-- OMR마킹 중 학생이 화면을 벗어나면(다른 앱 전환·화면 잠금 등) 그 시점의
-- 답안으로 즉시 자동 제출·잠금시킨다 — 정답 검색을 위한 이탈을 막기 위함.
-- left_app으로 그 강제 제출 여부를 남겨 학생 본인 결과 화면에 표시한다.
alter table clinic_omr_submissions add column left_app boolean not null default false;
