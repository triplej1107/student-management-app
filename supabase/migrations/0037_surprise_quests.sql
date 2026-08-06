-- 돌발퀘스트 — 종주T가 평소 업무 외에 갑자기 부탁하는 일.
--
-- 흐름: 종주T가 보냄 → 조교가 확인 → 조교가 완료 → 종주T가 피드백 또는
-- 그냥 확인 → (피드백이 있으면) 조교가 읽고 확인 → 끝.
-- 어느 단계인지는 아래 시각 칸들로 판단한다(questStages.ts 참고).
--
-- 특정 조교를 지정하지 않고 그날 있는 조교 모두에게 보인다. 대신 누가
-- 확인하고 누가 끝냈는지는 남겨서 종주T가 알 수 있게 한다.
create table if not exists surprise_quests (
  id bigserial primary key,
  content text not null,
  created_at timestamptz not null default now(),
  acked_at timestamptz,
  acked_by bigint references staff(id) on delete set null,
  done_at timestamptz,
  done_by bigint references staff(id) on delete set null,
  feedback text,
  -- 종주T가 완료 건을 처리한 시각(피드백을 썼든 그냥 확인만 했든).
  reviewed_at timestamptz,
  -- 조교가 피드백을 읽고 확인을 누른 시각.
  feedback_seen_at timestamptz
);
alter table surprise_quests enable row level security;

create index if not exists surprise_quests_created_idx on surprise_quests (created_at);

-- 자주 쓰는 요청 문구 — 버튼 한 번으로 보낼 수 있게 저장해둔다.
create table if not exists quest_presets (
  id bigserial primary key,
  content text not null,
  created_at timestamptz not null default now()
);
alter table quest_presets enable row level security;
