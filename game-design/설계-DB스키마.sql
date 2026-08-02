-- 슬라임 키우기 게임 — DB 스키마 초안 v2 (2026-08-02, 최신 앱 pull 후 정합화)
-- 통합 시 supabase/migrations/0033_slime_game.sql 로 들어갈 파일.
-- 기존 컨벤션 준수: 모든 테이블 RLS enable + no policy (서버 service role만 접근),
-- bigserial PK, 학생 삭제 시 cascade.
--
-- 최신 앱과의 정합 (v1에서 바뀐 점):
--   · UJC 지갑은 이미 존재 (0013 ujc_transactions, 주당 1 UJC 적립,
--     10/20/30 UJC = 5천/1.5만/2만원 기프티콘 교환). 새 ujc_ledger를 만들지
--     않고 ujc_transactions의 reason_type을 확장해서 쓴다.
--   · 재원 시작일은 이미 존재 (0029 students.first_lesson_date) — 근속
--     배율·게이트 기준으로 이 컬럼을 사용. enrolled_since 추가하지 않음.
--   · UJC는 실물 가치가 있으므로 게임은 UJC를 새로 발행하지 않는다.
--     레벨업 등 게임 보상은 '뽑기권'(gacha_tickets)으로 지급.
--
-- 배틀 테이블은 2차 업데이트(9월) 때 0034로 분리 예정이라 여기 없음.

-- ============================================================
-- ujc_transactions 확장 — 뽑기 결제를 기존 지갑 원장에 기록
-- ============================================================
alter table ujc_transactions drop constraint ujc_transactions_reason_type_check;
alter table ujc_transactions add constraint ujc_transactions_reason_type_check
  check (reason_type in ('clinic_complete', 'manual_grant', 'exchange', 'reset', 'gacha_cost'));

-- ============================================================
-- game_seasons — 시즌 (매년 3월 1일 전원 환생)
-- 진화 임계값을 시즌별 jsonb로 두는 이유: 시즌0(2026-08-22~2027-02-28)은
-- 반쪽 시즌이라 전직 기준을 낮춰야 함 (8000 → 6000).
-- ============================================================
create table game_seasons (
  id bigserial primary key,
  key text unique not null,                -- '2026-2'(시즌0), '2027', '2028' ...
  starts_on date not null,
  ends_on date not null,
  evolve_thresholds jsonb not null default '{"hatch":150,"teen":1200,"awake":3500,"job":8000}'::jsonb,
  created_at timestamptz not null default now()
);
alter table game_seasons enable row level security;

-- (v1의 enrolled_since 추가는 삭제 — 0029의 students.first_lesson_date 사용)

-- ============================================================
-- personality_tests — 성향 테스트 응시 기록 (시즌당 1회)
-- scores 전체를 남겨 환생 시 전년 대비 변화 리포트를 만든다.
-- ============================================================
create table personality_tests (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  season_id bigint not null references game_seasons(id),
  answers integer[] not null,              -- 문항별 선택 인덱스
  scores jsonb not null,                   -- {"fire":3,"water":1,"wood":2,"gold":1,"earth":1}
  result_attr text not null check (result_attr in ('fire','water','wood','gold','earth')),
  created_at timestamptz not null default now(),
  unique (student_id, season_id)
);
alter table personality_tests enable row level security;

-- ============================================================
-- slimes — 시즌당 학생 1마리. 선대는 행으로 남아 '전당'이 된다.
-- xp는 캐시값 — 진실은 xp_events 합계이며, 불일치 시 재계산으로 복구 가능.
-- ============================================================
create table slimes (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  season_id bigint not null references game_seasons(id),
  generation integer not null default 1,   -- 환생 세대 (전당 표시·직업 트리 결정)
  attribute text not null check (attribute in ('fire','water','wood','gold','earth')),
  stage text not null default 'egg' check (stage in ('egg','baby','teen','awake','job')),
  job_key text,                            -- 전직 후 직업 코드 (문사/음유시인 등)
  name text not null default '',           -- 학생이 붙인 이름 (금칙어 필터 서버에서)
  xp integer not null default 0,
  hatched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, season_id)
);
alter table slimes enable row level security;

-- ============================================================
-- xp_events — XP 원장. source_key 멱등이 핵심:
--   출석 'att:2026-08-25', 숙제 'hw:2026-08-25:3', 테스트 'test:2026-08-25:1',
--   향상 'improve:2026-08-25:1', 주간 정산 'weekly:2026-W35' ...
-- 조교가 체크를 해제하면 해당 이벤트를 삭제(또는 음수 이벤트)해 정합 유지.
-- 재체크돼도 unique 제약이 이중 지급을 막는다.
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
-- gacha_tickets — 뽑기권 원장. 게임 보상은 UJC 대신 뽑기권으로 지급해
-- 실물 가치가 있는 UJC를 새로 발행하지 않는다.
-- 획득: 레벨업, 주간 미션, 중복 조각 10개 교환, 이벤트. 소모: 뽑기 1회 = 1장.
-- ============================================================
create table gacha_tickets (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  delta integer not null,                  -- 지급 양수 / 사용 음수
  kind text not null,                      -- levelup|mission|shards|event|admin|pull
  source_key text,                         -- 멱등 필요한 지급만 (levelup:12 등)
  created_at timestamptz not null default now(),
  unique (student_id, source_key)          -- source_key null은 중복 허용(postgres 기본)
);
alter table gacha_tickets enable row level security;

-- ============================================================
-- items — 아이템 카탈로그 (관리자가 등록)
-- render에 SVG 파츠 파라미터를 넣어 이미지 파일 없이 렌더링.
-- ============================================================
create table items (
  id bigserial primary key,
  code text unique not null,               -- 'wp_pencil_sword' 등
  name text not null,
  category text not null check (category in ('weapon','shield','hat','eyewear','background','effect')),
  rarity text not null check (rarity in ('common','magic','rare','unique','legendary')),
  stats jsonb not null default '{}'::jsonb,   -- {"atk":4} {"def":4} {"crit":0.05} 꾸미기는 {}
  render jsonb not null default '{}'::jsonb,  -- SVG 파츠 파라미터
  source text not null default 'gacha' check (source in ('gacha','tenure','event','admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table items enable row level security;

-- ============================================================
-- inventory / slime_equipment — 보유와 착용 분리.
-- 아이템·UJC는 환생해도 계승되므로 inventory는 시즌 무관.
-- ============================================================
create table inventory (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  item_id bigint not null references items(id),
  obtained_via text not null,              -- gacha|tenure|event|admin|refunded(중복 환급 시 표시)
  created_at timestamptz not null default now()
);
alter table inventory enable row level security;

create table slime_equipment (
  slime_id bigint not null references slimes(id) on delete cascade,
  slot text not null check (slot in ('weapon','shield','hat','eyewear','background','effect')),
  inventory_id bigint not null references inventory(id) on delete cascade,
  primary key (slime_id, slot)
);
alter table slime_equipment enable row level security;

-- ============================================================
-- gacha_pulls — 뽑기 감사 로그 + 천장(pity) 추적
-- pity_count: 이 뽑기 직전까지 유니크 이상 미출현 연속 횟수. 30 도달 시 확정.
-- ============================================================
create table gacha_pulls (
  id bigserial primary key,
  student_id bigint not null references students(id) on delete cascade,
  paid_with text not null check (paid_with in ('ujc', 'ticket')),
  cost integer not null,                   -- ujc면 UJC 수량(기본 2), ticket이면 1
  item_id bigint not null references items(id),
  rarity text not null,
  pity_count integer not null,
  created_at timestamptz not null default now()
);
alter table gacha_pulls enable row level security;

-- ============================================================
-- xp_multiplier_events — 원장이 켜는 XP 배율 이벤트 (수행평가·방학 등)
-- 겹치는 기간은 서버에서 최대값 하나만 적용.
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
create index idx_ujc_ledger_student on ujc_ledger (student_id, created_at);
create index idx_slimes_season on slimes (season_id);
create index idx_inventory_student on inventory (student_id);
create index idx_gacha_student on gacha_pulls (student_id, created_at);

-- 시즌0 시드
insert into game_seasons (key, starts_on, ends_on, evolve_thresholds)
values ('2026-2', '2026-08-22', '2027-02-28',
        '{"hatch":150,"teen":1200,"awake":3500,"job":6000}'::jsonb);
