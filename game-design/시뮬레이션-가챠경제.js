// UJC 10배 뻥튀기 안 검증
// 1 UJC = 1뽑 / 10 UJC = 11뽑 / 100 UJC = 120뽑 + 레전더리 파츠 1개 확정
// 기존생: 보유 25×10 = 250 UJC. 주간 10 UJC(완벽 수행) + 재량 지급 α

function rand() { return Math.random(); }

const EPIC_SETS = 11, PARTS = 5, LEGEND_SETS = 5, RARE_SETS = 15, MAGIC_SETS = 15, COMMON_POOL = 33;
const SHARD = { common: 1, magic: 1, rare: 3, epic: 20, legendary: 100 };
const EPIC_COST = 100, LEGEND_COST = 500;
let GUARANTEE_TIER = "legendary"; // 100연뽑 확정 파츠 등급

/** UJC를 최적 단위로 쪼개 뽑기 횟수 + 확정 레전더리 파츠 수 계산 */
function spendUjc(ujc) {
  const hundreds = Math.floor(ujc / 100);
  let rest = ujc - hundreds * 100;
  const tens = Math.floor(rest / 10);
  rest -= tens * 10;
  return {
    pulls: hundreds * 120 + tens * 11 + rest,
    guaranteedLegendParts: hundreds,
  };
}

function simulate(totalUjc) {
  const { pulls, guaranteedLegendParts } = spendUjc(totalUjc);
  const owned = { common: new Set(), magic: new Set(), rare: new Set(), epic: new Set(), legendary: new Set() };
  let shards = 0, pity = 0;
  const targetEpic = 0, targetLegend = 0;

  // 100연뽑 확정 파츠 — GUARANTEE_TIER에 따라 에픽/레전더리 결정
  for (let i = 0; i < guaranteedLegendParts; i++) {
    const bag = GUARANTEE_TIER === "legendary" ? owned.legendary : owned.epic;
    const target = GUARANTEE_TIER === "legendary" ? targetLegend : targetEpic;
    let placed = false;
    for (let p = 0; p < PARTS; p++) {
      if (!bag.has(`${target}:${p}`)) { bag.add(`${target}:${p}`); placed = true; break; }
    }
    if (!placed) shards += SHARD[GUARANTEE_TIER];
  }

  for (let i = 0; i < pulls; i++) {
    pity++;
    let tier;
    if (pity >= 20) { tier = "epic"; pity = 0; }
    else {
      const r = rand() * 100;
      if (r < 50) tier = "common";
      else if (r < 80) tier = "magic";
      else if (r < 95) tier = "rare";
      else if (r < 99) { tier = "epic"; pity = 0; }
      else { tier = "legendary"; pity = 0; }
    }
    let key;
    if (tier === "common") key = `${Math.floor(rand() * COMMON_POOL)}`;
    else if (tier === "magic") key = `${Math.floor(rand() * MAGIC_SETS)}:${Math.floor(rand() * PARTS)}`;
    else if (tier === "rare") key = `${Math.floor(rand() * RARE_SETS)}:${Math.floor(rand() * PARTS)}`;
    else if (tier === "epic") key = `${Math.floor(rand() * EPIC_SETS)}:${Math.floor(rand() * PARTS)}`;
    else key = `${Math.floor(rand() * LEGEND_SETS)}:${Math.floor(rand() * PARTS)}`;
    if (owned[tier].has(key)) shards += SHARD[tier];
    else owned[tier].add(key);
  }

  let epicHave = 0, legendHave = 0;
  for (let p = 0; p < PARTS; p++) {
    if (owned.epic.has(`${targetEpic}:${p}`)) epicHave++;
    if (owned.legendary.has(`${targetLegend}:${p}`)) legendHave++;
  }
  const epicNeed = PARTS - epicHave;
  const legendNeed = PARTS - legendHave;

  // 조각은 에픽 완성에 먼저 쓰고, 남으면 레전더리에
  const epicBuy = Math.min(epicNeed, Math.floor(shards / EPIC_COST));
  const afterEpic = shards - epicBuy * EPIC_COST;
  const legendBuy = Math.min(legendNeed, Math.floor(afterEpic / LEGEND_COST));

  return {
    pulls,
    epicDone: epicBuy >= epicNeed,
    legendDone: legendBuy >= legendNeed,
    legendParts: legendHave,
    shards,
  };
}

function report(label, totalUjc, N = 5000) {
  let e = 0, l = 0, lp = 0, sh = 0, pl = 0;
  for (let i = 0; i < N; i++) {
    const r = simulate(totalUjc);
    if (r.epicDone) e++;
    if (r.legendDone) l++;
    lp += r.legendParts; sh += r.shards; pl = r.pulls;
  }
  console.log(
    `${label} (${totalUjc} UJC → ${pl}뽑) | 에픽세트 ${(e / N * 100).toFixed(1)}% · 레전세트 ${(l / N * 100).toFixed(1)}% · 레전파츠 평균 ${(lp / N).toFixed(1)}/5 · 잔여조각 ${(sh / N).toFixed(0)}`
  );
}

console.log("=== 연말까지(19주) — 기존생: 보유 250 + 주간 10×19 = 440 UJC ===");
report("재량지급 0", 440);
report("재량지급 주3", 440 + 3 * 19);
report("재량지급 주5", 440 + 5 * 19);
report("재량+집공부 주10", 440 + 10 * 19);

console.log("\n=== 연말까지 — 신규생: 보유 0 + 주간 10×19 = 190 UJC ===");
report("재량지급 0", 190);
report("재량지급 주3", 190 + 3 * 19);
report("재량+집공부 주10", 190 + 10 * 19);

console.log("\n=== 1년 재원(52주, 보유 0) ===");
report("주간10만", 520);
report("주간10+재량3", 520 + 3 * 52);

console.log("\n=== 1년 반 재원(78주, 보유 0) — 레전더리 목표 ===");
report("주간10만", 780);
report("주간10+재량3", 780 + 3 * 78);

console.log("\n\n########## [수정안] 100연뽑 확정 파츠를 '에픽'으로 ##########");
GUARANTEE_TIER = "epic";
console.log("=== 연말까지(19주) 기존생 ===");
report("재량지급 0", 440);
report("재량지급 주3", 440 + 3 * 19);
report("재량+집공부 주10", 440 + 10 * 19);
console.log("=== 연말까지 신규생 ===");
report("재량지급 주3", 190 + 3 * 19);
console.log("=== 1년 재원 ===");
report("주간10+재량3", 520 + 3 * 52);
console.log("=== 1년 반 재원 — 레전더리 목표 ===");
report("주간10만", 780);
report("주간10+재량3", 780 + 3 * 78);
report("주간10+재량5", 780 + 5 * 78);
