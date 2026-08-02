-- 슬라임 키우기 게임 v1 — 기반 테이블
-- 설계: game-design/ 폴더 (CONTEXT.md, 설계-*.md) 참고.
--
-- 핵심 결정 반영:
--   · 속성은 부화 시 서버가 랜덤 배정 (성향 테스트는 보류 — 테이블만 준비,
--     2027-03 환생 때 도입 예정). 알 단계에서는 attribute가 null.
--   · UJC는 실물 가치 재화(주 1개 적립, 기프티콘 교환)라 게임이 새로 발행하지
--     않는다. 뽑기 1회 = 1 UJC 또는 뽑기권 1장. 게임 보상 = 뽑기권.
--   · 아이템은 콘셉트 세트(set_key) 단위 — 3부위 완성 시 세트 효과.

-- ============================================================
-- game_seasons — 시즌 (매년 3월 1일 전원 환생)
-- 시즌0(2026-2)은 반쪽 시즌이라 전직 임계값을 낮춘다 (8000 → 6000).
-- ============================================================
create table game_seasons (
  id bigserial primary key,
  key text unique not null,                -- '2026-2', '2027', '2028' ...
  starts_on date not null,
  ends_on date not null,
  evolve_thresholds jsonb not null default '{"hatch":150,"teen":1200,"awake":3500,"job":8000}'::jsonb,
  created_at timestamptz not null default now()
);
alter table game_seasons enable row level security;

-- ============================================================
-- ujc_transactions 확장 — 뽑기 결제를 기존 지갑 원장에 기록
-- ============================================================
alter table ujc_transactions drop constraint ujc_transactions_reason_type_check;
alter table ujc_transactions add constraint ujc_transactions_reason_type_check
  check (reason_type in ('clinic_complete', 'manual_grant', 'exchange', 'reset', 'gacha_cost'));

-- ============================================================
-- personality_tests — 성향 테스트 (v1 미사용, 2027-03 환생 도입 대비)
-- ============================================================
create table personality_tests (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  season_id bigint not null references game_seasons(id),
  answers integer[] not null,
  scores jsonb not null,                   -- {"fire":3,"water":1,...} 전체 저장 (전년 비교 리포트용)
  result_attr text not null check (result_attr in ('fire','water','wood','gold','earth')),
  created_at timestamptz not null default now(),
  unique (student_id, season_id)
);
alter table personality_tests enable row level security;

-- ============================================================
-- slimes — 시즌당 학생 1마리. 지난 시즌 행이 곧 '전당'.
-- 알 단계에선 속성 미공개(null) — 부화 시 랜덤 배정하면서 채운다.
-- xp는 캐시값, 진실은 xp_events 합계 (불일치 시 재계산).
-- ============================================================
create table slimes (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  season_id bigint not null references game_seasons(id),
  generation integer not null default 1,   -- 환생 세대 (직업 트리 등급 결정)
  attribute text check (attribute in ('fire','water','wood','gold','earth')),
  stage text not null default 'egg' check (stage in ('egg','baby','teen','awake','job')),
  job_key text,
  name text not null default '',
  xp integer not null default 0,
  hatched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, season_id),
  check (stage = 'egg' or attribute is not null)
);
alter table slimes enable row level security;

-- ============================================================
-- xp_events — XP 원장. source_key 멱등이 핵심:
--   'att:2026-08-25', 'hw:2026-08-25:3', 'test:2026-08-25:1',
--   'improve:2026-08-25:1', 'weekly:2026-W35' ...
-- 체크 해제 시 해당 이벤트 삭제로 정합 유지. 재체크는 unique가 이중 지급 차단.
-- ============================================================
create table xp_events (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  season_id bigint not null references game_seasons(id),
  kind text not null,                      -- attendance|homework|test|improve|streak|event|admin
  source_key text not null,
  base_amount integer not null,
  multiplier numeric not null default 1,   -- 근속 × 스트릭 × 이벤트 배율 (지급 시점 스냅샷)
  amount integer not null,                 -- round(base_amount × multiplier)
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (student_id, source_key)
);
alter table xp_events enable row level security;

-- ============================================================
-- gacha_tickets — 뽑기권 원장. 게임 보상은 UJC 대신 뽑기권으로.
-- 획득: 레벨업·주간 미션·조각 10개 교환·이벤트. 소모: 뽑기 1회 = 1장.
-- 잔고 = sum(delta). 조각(shard)도 여기서 kind='shard'로 관리 (조각 잔고 별도 합산).
-- ============================================================
create table gacha_tickets (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  delta integer not null,                  -- 지급 양수 / 사용 음수
  kind text not null,                      -- levelup|mission|shards|event|admin|pull|shard
  source_key text,                         -- 멱등 필요한 지급만 (levelup:12 등)
  created_at timestamptz not null default now(),
  unique (student_id, source_key)
);
alter table gacha_tickets enable row level security;

-- ============================================================
-- game_items — 게임 아이템 카탈로그 (UJC 마켓의 ujc_market_items와 별개)
-- render에 도트 스프라이트/파라미터를 넣어 이미지 파일 없이 렌더링.
-- ============================================================
create table game_items (
  id bigserial primary key,
  code text unique not null,               -- 'holysword', 'straw' 등 (랩 스프라이트 키와 일치)
  name text not null,
  category text not null check (category in ('weapon','shield','hat','eyewear','background','effect')),
  rarity text not null check (rarity in ('common','magic','rare','unique','legendary')),
  set_key text,                            -- 콘셉트 세트 (knight|farmer|caveman|miner|wizard|soldier|pirate|ninja|shaman)
  stats jsonb not null default '{}'::jsonb,   -- {"atk":4} {"def":4} 치장은 {}
  render jsonb not null default '{}'::jsonb,
  source text not null default 'gacha' check (source in ('gacha','tenure','event','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table game_items enable row level security;

-- ============================================================
-- game_inventory / slime_equipment — 보유와 착용 분리. 환생해도 계승.
-- ============================================================
create table game_inventory (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  item_id bigint not null references game_items(id),
  obtained_via text not null,              -- gacha|tenure|event|admin
  created_at timestamptz not null default now()
);
alter table game_inventory enable row level security;

create table slime_equipment (
  slime_id bigint not null references slimes(id) on delete cascade,
  slot text not null check (slot in ('weapon','shield','hat','eyewear','background','effect')),
  inventory_id bigint not null references game_inventory(id) on delete cascade,
  primary key (slime_id, slot)
);
alter table slime_equipment enable row level security;

-- ============================================================
-- gacha_pulls — 뽑기 감사 로그 + 천장(pity) 추적
-- pity_count: 이 뽑기 직전까지 유니크 이상 미출현 연속 횟수. 20 도달 시 확정.
-- UJC 차감 / 뽑기권 차감 / 아이템 지급은 서버에서 한 트랜잭션으로 묶을 것.
-- ============================================================
create table gacha_pulls (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  paid_with text not null check (paid_with in ('ujc', 'ticket')),
  cost integer not null,                   -- ujc면 1, ticket이면 1
  item_id bigint not null references game_items(id),
  rarity text not null,
  pity_count integer not null,
  created_at timestamptz not null default now()
);
alter table gacha_pulls enable row level security;

-- ============================================================
-- xp_multiplier_events — 원장이 켜는 XP 배율 이벤트 (수행평가·방학 등)
-- 겹치면 최대값 하나만 적용 (서버 로직).
-- ============================================================
create table xp_multiplier_events (
  id bigserial primary key,
  label text not null,                     -- '수행평가 기간 2배!'
  multiplier numeric not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now()
);
alter table xp_multiplier_events enable row level security;

-- 인덱스
create index idx_xp_events_student_season on xp_events (student_id, season_id, created_at);
create index idx_gacha_tickets_student on gacha_tickets (student_id, created_at);
create index idx_slimes_season on slimes (season_id);
create index idx_game_inventory_student on game_inventory (student_id);
create index idx_gacha_pulls_student on gacha_pulls (student_id, created_at);

-- 시즌0 시드 (2026-08-22 개강 ~ 2027-02-28, 전직 임계 6000)
insert into game_seasons (key, starts_on, ends_on, evolve_thresholds)
values ('2026-2', '2026-08-22', '2027-02-28',
        '{"hatch":150,"teen":1200,"awake":3500,"job":6000}'::jsonb);
