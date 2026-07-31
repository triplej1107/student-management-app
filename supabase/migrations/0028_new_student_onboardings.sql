-- "아싸신규" — 학원 단톡으로 신규 안내가 오면 종주T가 이름·학교·학년만
-- 적어두고, 조교·종주T가 함께 6개 항목을 챙기는 체크리스트. 6개를 전부
-- 체크해야 홈 화면에서 사라진다(챙길 걸 빠뜨리는 일을 막기 위함).
create table new_student_onboardings (
  id bigserial primary key,
  name text not null,
  school text,
  grade text,
  checks boolean[] not null default array[false, false, false, false, false, false],
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table new_student_onboardings enable row level security;

create index new_student_onboardings_open_idx
  on new_student_onboardings (created_at)
  where completed_at is null;
