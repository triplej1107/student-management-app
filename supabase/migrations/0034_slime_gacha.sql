-- 슬라임 뽑기(가챠) — 아이템 시드 + 원자적 뽑기 함수
-- 설계: game-design/설계-아이템카탈로그.md §4 (뽑기 1 UJC, 천장 20, 중복=조각 3, 조각 10=뽑기권 1)
--
-- v1 풀은 디자인 랩에 도트가 구현된 14종. 이후 세트가 완성될 때마다
-- game_items에 insert만 하면 풀에 자동 편입된다.

insert into game_items (code, name, category, rarity, set_key, stats) values
  ('woodsword',   '나무 검',           'weapon',  'common',    'knight', '{"atk":1}'),
  ('knightsword', '기사의 장검',       'weapon',  'rare',      'knight', '{"atk":3}'),
  ('holysword',   '성검 유종',         'weapon',  'legendary', 'knight', '{"atk":6}'),
  ('staff',       '마법사 지팡이',     'weapon',  'rare',      'wizard', '{"atk":3}'),
  ('woodshield',  '나무 원방패',       'shield',  'common',    'knight', '{"def":1}'),
  ('kite',        '기사의 카이트 실드','shield',  'rare',      'knight', '{"def":3}'),
  ('dragonscale', '용비늘 방패',       'shield',  'legendary', 'knight', '{"def":6}'),
  ('spellbook',   '마법서',            'shield',  'rare',      'wizard', '{"def":3}'),
  ('straw',       '밀짚모자',          'hat',     'common',    'farmer', '{"def":1}'),
  ('wizard',      '마법사 고깔',       'hat',     'rare',      'wizard', '{"def":3}'),
  ('crown',       '수석의 왕관',       'hat',     'legendary', null,     '{"def":6}'),
  ('horn',        '뿔테안경',          'eyewear', 'common',    null,     '{}'),
  ('sun',         '선글라스',          'eyewear', 'magic',     null,     '{}'),
  ('monocle',     '모노클',            'eyewear', 'unique',    null,     '{}');

-- 뽑기 1회를 하나의 트랜잭션으로 처리:
--   결제(뽑기권 우선, 없으면 UJC 1) → 천장 판정 → 등급 추첨 → 아이템 추첨
--   → 중복이면 조각 +3 (10개 모이면 자동으로 뽑기권 1장 전환) / 아니면 인벤토리 지급
-- pg_advisory_xact_lock으로 같은 학생의 동시 뽑기(새로고침 연타)를 직렬화한다.
create or replace function slime_gacha_pull(p_student_id bigint)
returns jsonb
language plpgsql
as $$
declare
  v_tickets integer;
  v_ujc integer;
  v_paid_with text;
  v_pity integer;
  v_roll numeric;
  v_rarity text;
  v_item game_items%rowtype;
  v_dupe boolean;
  v_shards integer;
  v_converted boolean := false;
begin
  perform pg_advisory_xact_lock(837261, p_student_id::integer);

  -- 결제 수단: 뽑기권 우선, 없으면 UJC 1개
  select coalesce(sum(delta), 0) into v_tickets
  from gacha_tickets where student_id = p_student_id and kind <> 'shard';

  if v_tickets > 0 then
    v_paid_with := 'ticket';
  else
    select coalesce(sum(amount), 0) into v_ujc
    from ujc_transactions where student_id = p_student_id;
    if v_ujc < 1 then
      raise exception 'insufficient_balance';
    end if;
    v_paid_with := 'ujc';
  end if;

  -- 천장: 마지막 유니크+ 이후 연속 뽑기 수. 20회째(직전 19회 꽝)는 유니크 확정.
  select count(*) into v_pity from gacha_pulls
  where student_id = p_student_id
    and id > coalesce(
      (select max(id) from gacha_pulls
       where student_id = p_student_id and rarity in ('unique', 'legendary')), 0);

  -- 등급 추첨: 일반50 / 매직30 / 레어15 / 유니크4 / 레전더리1 (%)
  v_roll := random() * 100;
  v_rarity := case
    when v_roll < 50 then 'common'
    when v_roll < 80 then 'magic'
    when v_roll < 95 then 'rare'
    when v_roll < 99 then 'unique'
    else 'legendary'
  end;
  if v_pity >= 19 and v_rarity not in ('unique', 'legendary') then
    v_rarity := 'unique';
  end if;

  -- 아이템 추첨 — 그 등급이 비어 있으면 바로 아래 채워진 등급에서 뽑는다
  select * into v_item from game_items
  where rarity = v_rarity and active and source = 'gacha'
  order by random() limit 1;

  if v_item.id is null then
    select g.* into v_item from game_items g
    where g.active and g.source = 'gacha'
      and array_position(array['common','magic','rare','unique','legendary'], g.rarity)
        <= array_position(array['common','magic','rare','unique','legendary'], v_rarity)
    order by array_position(array['common','magic','rare','unique','legendary'], g.rarity) desc, random()
    limit 1;
  end if;
  if v_item.id is null then
    raise exception 'no_items';
  end if;

  -- 결제 기록
  if v_paid_with = 'ticket' then
    insert into gacha_tickets (student_id, delta, kind) values (p_student_id, -1, 'pull');
  else
    insert into ujc_transactions (student_id, amount, reason_type, reason_note)
    values (p_student_id, -1, 'gacha_cost', '슬라임 뽑기');
  end if;

  insert into gacha_pulls (student_id, paid_with, cost, item_id, rarity, pity_count)
  values (p_student_id, v_paid_with, 1, v_item.id, v_item.rarity, v_pity);

  -- 지급: 신규면 인벤토리, 중복이면 조각 +3 (10개 도달 시 자동 뽑기권 전환)
  select exists(
    select 1 from game_inventory where student_id = p_student_id and item_id = v_item.id
  ) into v_dupe;

  if v_dupe then
    insert into gacha_tickets (student_id, delta, kind) values (p_student_id, 3, 'shard');
    select coalesce(sum(delta), 0) into v_shards
    from gacha_tickets where student_id = p_student_id and kind = 'shard';
    if v_shards >= 10 then
      insert into gacha_tickets (student_id, delta, kind) values (p_student_id, -10, 'shard');
      insert into gacha_tickets (student_id, delta, kind) values (p_student_id, 1, 'shards');
      v_shards := v_shards - 10;
      v_converted := true;
    end if;
  else
    insert into game_inventory (student_id, item_id, obtained_via)
    values (p_student_id, v_item.id, 'gacha');
    select coalesce(sum(delta), 0) into v_shards
    from gacha_tickets where student_id = p_student_id and kind = 'shard';
  end if;

  return jsonb_build_object(
    'item_code', v_item.code,
    'item_name', v_item.name,
    'category', v_item.category,
    'rarity', v_item.rarity,
    'set_key', v_item.set_key,
    'dupe', v_dupe,
    'paid_with', v_paid_with,
    'shards', v_shards,
    'shard_converted', v_converted,
    'pity_count', v_pity
  );
end;
$$;
