-- 학생/학부모 계정이 "설치된(standalone) 상태"로 앱을 연 적이 있는지
-- 근사 추적. 실시간 설치 여부 API는 없어서, 홈 화면 로드 시 display-mode가
-- standalone이면 그 시각을 기록하는 방식으로 대신한다.
alter table students add column student_app_seen_at timestamptz;
alter table students add column parent_app_seen_at timestamptz;
