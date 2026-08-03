// 1 UJC = 1뽑 유지 · UJC 주 10개(10배안) 유지
// 조이는 레버: 천장 주기, 조각 비용, 시즌0 에픽 공개 세트 수
// 목표: 한 학기(신규생 190뽑)에 에픽 세트 1개, 도감은 여유 남기기
function rand() { return Math.random(); }

const PARTS = 5;
const COMMON_POOL = 33;
const TIERS = ["common", "magic", "rare", "epic", "legendary"];

function weeklyXP() {
  let xp = 0;
  const r = rand();
  if (r < 0.82) xp += 50; else if (r < 0.92) xp += 20; else if (r < 0.97) xp += 30;
  const hw = Math.round(Math.min(7, Math.max(0, 5.2 + (rand() - 0.5) * 3)));
  xp += hw * 10 + (hw === 7 ? 30 : 0);
  for (let t = 0; t < 4; t++) {
    const rate = Math.min(1, Math.max(0, 0.68 + (rand() - 0.5) * 0.34));
    xp += Math.round(rate * 15);
    if (rand() < 0.25) xp += 20;
  }
  return { xp, perfect: r < 0.82 && hw === 7 };
}

function pullBudget(weeks, banked) {
  let cum = 0, pulls = banked;
  for (let w = 0; w < weeks; w++) {
    const { xp, perfect } = weeklyXP();
    const prev = Math.floor(cum / 300);
    cum += xp;
    pulls += Math.floor(cum / 300) - prev;
    if (perfect) pulls += 1;
    pulls += 10; // 주 10 UJC = 10뽑
  }
  return pulls;
}

function simulate(pulls, pityLimit, shardCost, epicSets) {
  const POOL = { legendary: 2, epic: epicSets, rare: 4, magic: 5 };
  const owned = {}, shard = {};
  for (const t of TIERS) { owned[t] = new Set(); shard[t] = 0; }
  let pity = 0;
  for (let i = 0; i < pulls; i++) {
    pity++;
    let tier;
    if (pity >= pityLimit) { tier = "epic"; pity = 0; }
    else {
      const r = rand() * 100;
      if (r < 50) tier = "common";
      else if (r < 80) tier = "magic";
      else if (r < 95) tier = "rare";
      else if (r < 99) { tier = "epic"; pity = 0; }
      else { tier = "legendary"; pity = 0; }
    }
    const key = tier === "common"
      ? `${Math.floor(rand() * COMMON_POOL)}`
      : `${Math.floor(rand() * POOL[tier])}:${Math.floor(rand() * PARTS)}`;
    if (owned[tier].has(key)) shard[tier]++;
    else owned[tier].add(key);
  }
  const have = (t, s) => { let n = 0; for (let p = 0; p < PARTS; p++) if (owned[t].has(`${s}:${p}`)) n++; return n; };
  // 학생은 '가장 많이 모인 세트'를 목표로 삼는다 (현실적인 행동)
  let eHave = 0;
  for (let s = 0; s < POOL.epic; s++) eHave = Math.max(eHave, have("epic", s));
  const epicShards = shard.epic + shard.legendary * 3;
  const eBuy = Math.min(PARTS - eHave, Math.floor(epicShards / shardCost));
  // 완성된 에픽 세트 수(뽑기만으로)
  let doneSets = 0;
  for (let s = 0; s < POOL.epic; s++) if (have("epic", s) === PARTS) doneSets++;
  const collected = TIERS.reduce((n, t) => n + owned[t].size, 0);
  const total = COMMON_POOL + (POOL.magic + POOL.rare + POOL.epic + POOL.legendary) * PARTS;
  return {
    epicDone: eBuy >= PARTS - eHave,
    doneSets,
    epicOwned: owned.epic.size, epicPool: POOL.epic * PARTS,
    legendAny: owned.legendary.size > 0,
    shardsLeft: epicShards - eBuy * shardCost,
    collectPct: collected / total,
  };
}

function report(label, weeks, banked, pity, cost, epicSets, N = 5000) {
  let e = 0, ds = 0, eo = 0, la = 0, sl = 0, cp = 0, pl = 0;
  for (let i = 0; i < N; i++) {
    const p = pullBudget(weeks, banked);
    pl += p;
    const r = simulate(p, pity, cost, epicSets);
    if (r.epicDone) e++;
    ds += r.doneSets; eo += r.epicOwned; if (r.legendAny) la++; sl += r.shardsLeft; cp += r.collectPct;
  }
  console.log(
    `  ${label} ${(pl / N).toFixed(0)}뽑 | 에픽세트완성 ${(e / N * 100).toFixed(0)}%` +
    ` · 뽑기만으로 완성 ${(ds / N).toFixed(2)}세트 · 에픽수집 ${(eo / N).toFixed(1)}/${epicSets * 5}` +
    ` · 남는조각 ${(sl / N).toFixed(1)} · 레전보유 ${(la / N * 100).toFixed(0)}% · 도감 ${(cp / N * 100).toFixed(0)}%`
  );
}

console.log("[목표 세트 = 가장 많이 모인 세트로 갈아탐 (현실적 행동)]");
for (const cost of [3, 4, 5]) {
  console.log(`\n### 천장 100회 · 조각 ${cost}개=부위1 · 에픽 3세트 ###`);
  report("한학기 신규생 ", 19, 0, 100, cost, 3);
  report("연말 기존생   ", 19, 250, 100, cost, 3);
  report("두학기 신규생 ", 38, 0, 100, cost, 3);
  report("1년 재원     ", 52, 0, 100, cost, 3);
  report("1년반 재원   ", 78, 0, 100, cost, 3);
}
