-- 장학금 관리 —
-- (1) 회원명단 엑셀 [메모]/[비고] 열의 "OOO 소개" 원문을 학생에 그대로 보관한다.
--     이름 → 학생 매칭은 화면에서 그때그때 하므로 원문을 남겨야 나중에 오타나
--     동명이인을 사람이 눈으로 확인하고 고칠 수 있다.
alter table students add column if not exists referral_note text;

-- (2) 지급 대상 목록은 첫수업일·내신 성적에서 매번 새로 계산한다. 이 표에는
--     사람이 누른 결과("네이버 리뷰 확인했다", "지급했다")만 남긴다.
--     ref_key = 소개 장학금이면 소개받아 온 학생 id, 성적 장학금이면
--     "<학생id>:<시험슬롯>" (예: "42:g2s1mid").
create table if not exists scholarship_checks (
  id bigserial primary key,
  kind text not null check (kind in ('referral', 'grade')),
  ref_key text not null,
  review_done boolean not null default false,
  paid boolean not null default false,
  paid_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (kind, ref_key)
);
alter table scholarship_checks enable row level security;
