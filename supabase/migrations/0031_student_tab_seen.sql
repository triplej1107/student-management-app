-- 학생·학부모 하단 탭의 "새 소식" 점 표시용 — 각자 어느 탭을 언제 마지막으로
-- 봤는지 기록한다. 학생과 학부모는 같은 student_id를 공유하지만 서로 다른
-- 사람이라 role까지 함께 키로 잡는다.
create table student_tab_seen (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  role text not null,  -- 'student' | 'parent'
  tab text not null,   -- 'lesson' | 'clinic' | 'grades' | 'notices'
  seen_at timestamptz not null default now(),
  unique (student_id, role, tab)
);
alter table student_tab_seen enable row level security;

create index student_tab_seen_lookup_idx on student_tab_seen (student_id, role);
