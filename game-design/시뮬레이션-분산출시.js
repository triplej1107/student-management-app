// 분산 출시 시뮬 — "1년에 6번(중간/기말/방학 ×2학기) 나눠 업데이트하면?"
// 2026-08-03 원장 질문에 대한 검증.
//
// 시뮬레이션-오픈풀.js는 "풀 크기가 고정"인 경우만 봤다. 거기서 나온 결론은
// "풀을 줄이면 밸런스가 관대해진다"였는데, 분산 출시는 풀이 시간에 따라 커진다.
// 초반엔 좁은 풀(집중 → 빨리 완성)이고 후반엔 넓은 풀(희석)이라 결과가 다를 수 있다.
//
// v5 카탈로그 기준 (2026-08-03 원장 구상):
//   레전더리 5세트 / 에픽 10세트 / 레어 15세트 / 매직 15세트 (각 5부위)
//   일반 33종 개별 파츠 (세트 아님, 이펙트 슬롯 없음)
//   5부위 = 머리 / 얼굴 / 오른손 / 왼손 / 이펙트
//
// 실행: node 시뮬레이션-분산출시.js

const PARTS = 5, COMMON_POOL = 33;
const SHARD = { common: 1, magic: 1, rare: 3, epic: 20, legendary: 100 };
const EPIC_COST = 100, LEGEND_COST = 500;

// 시즌0 = 2026-08-22 ~ 2027-02-28 (약 27주). 1년 반 = 78주.
const SEASON0_END = 27, YEAR_HALF = 78;

/** UJC를 최적 단위로 쪼갠다: 100묶음(120뽑+에픽확정) → 10묶음(11뽑) → 1뽑 */
function spend(ujc) {
  const h = Math.floor(ujc / 100);
  let rest = ujc - h * 100;
  const t = Math.floor(rest / 10);
  rest -= t * 10;
  return { pulls: h * 120 + t * 11 + rest, guaranteedEpic: h };
}

/** 출시 일정: 해당 주차에 '누적' 몇 세트가 풀려 있는지 */
const SCHEDULES = {
  "전량 즉시 출시": [
    { week: 0, magic: 15, rare: 15, epic: 10, legend: 5 },
  ],
  "6회 분산 (오픈 넓게)": [
    { week: 0, magic: 5, rare: 5, epic: 3, legend: 2 },   // 8/22 개강
    { week: 8, magic: 8, rare: 8, epic: 4, legend: 2 },   // 10월 중간고사
    { week: 16, magic: 11, rare: 10, epic: 5, legend: 3 }, // 12월 기말고사
    { week: 21, magic: 13, rare: 12, epic: 7, legend: 3 }, // 1월 겨울방학
    { week: 32, magic: 15, rare: 14, epic: 8, legend: 4 }, // 4월 중간고사
    { week: 45, magic: 15, rare: 15, epic: 9, legend: 4 }, // 6월 기말고사
    { week: 52, magic: 15, rare: 15, epic: 10, legend: 5 }, // 7월 여름방학
  ],
  "6회 분산 (레전더리도 분산)": [
    { week: 0, magic: 3, rare: 3, epic: 2, legend: 1 },
    { week: 8, magic: 5, rare: 5, epic: 3, legend: 2 },
    { week: 16, magic: 8, rare: 7, epic: 4, legend: 2 },
    { week: 21, magic: 10, rare: 10, epic: 6, legend: 3 },
    { week: 32, magic: 13, rare: 12, epic: 7, legend: 4 },
    { week: 45, magic: 15, rare: 14, epic: 9, legend: 4 },
    { week: 52, magic: 15, rare: 15, epic: 10, legend: 5 },
  ],
  "6회 분산 (레전더리 전량 오픈)": [
    { week: 0, magic: 5, rare: 5, epic: 3, legend: 5 },
    { week: 8, magic: 8, rare: 8, epic: 4, legend: 5 },
    { week: 16, magic: 11, rare: 10, epic: 5, legend: 5 },
    { week: 21, magic: 13, rare: 12, epic: 7, legend: 5 },
    { week: 32, magic: 15, rare: 14, epic: 8, legend: 5 },
    { week: 45, magic: 15, rare: 15, epic: 9, legend: 5 },
    { week: 52, magic: 15, rare: 15, epic: 10, legend: 5 },
  ],
  "★권장 레전더리 전량 + 최소 오픈": [
    { week: 0, magic: 2, rare: 2, epic: 1, legend: 5 },
    { week: 8, magic: 5, rare: 5, epic: 3, legend: 5 },
    { week: 16, magic: 8, rare: 8, epic: 4, legend: 5 },
    { week: 21, magic: 11, rare: 11, epic: 6, legend: 5 },
    { week: 32, magic: 14, rare: 13, epic: 8, legend: 5 },
    { week: 45, magic: 15, rare: 15, epic: 9, legend: 5 },
    { week: 52, magic: 15, rare: 15, epic: 10, legend: 5 },
  ],
};

function releasedAt(schedule, week) {
  let cur = schedule[0];
  for (const s of schedule) if (s.week <= week) cur = s;
  return cur;
}

/**
 * 한 학생의 1년 반을 주 단위로 시뮬레이션.
 * 학생은 업데이트가 뜰 때마다 모아둔 UJC를 전부 쓴다 (신규 세트를 노리는 자연스러운 행동).
 * 타깃 세트 = 현재 가장 많이 모은 세트 (greedy — 완성이 가장 빠른 합리적 전략이라
 * 밸런스 관점에선 최악의 경우를 본다).
 */
function simulate({ startUjc, weeklyUjc, schedule, weeks, targetMode = "greedy" }) {
  const owned = { common: new Set(), magic: new Set(), rare: new Set(), epic: new Set(), legendary: new Set() };
  let ujc = startUjc, shards = 0, pity = 0;
  const snapshots = {};
  // 업데이트 주차 + 마지막 주에 소비
  const spendWeeks = new Set(schedule.map((s) => s.week));
  spendWeeks.add(weeks);
  spendWeeks.add(SEASON0_END);

  // greedy = 가장 많이 모은 세트로 계속 갈아탄다 (합리적 최적 플레이 = 완성 최속)
  // fixed  = 처음 정한 한 세트만 판다 (기존 시뮬레이션-가챠경제.js의 가정)
  const bestSet = (tier, pool) => {
    if (targetMode === "fixed") return 0;
    let best = 0, bestN = -1;
    for (let s = 0; s < pool; s++) {
      let n = 0;
      for (let p = 0; p < PARTS; p++) if (owned[tier].has(`${s}:${p}`)) n++;
      if (n > bestN) { bestN = n; best = s; }
    }
    return best;
  };

  for (let w = 0; w <= weeks; w++) {
    if (w > 0) ujc += weeklyUjc;
    if (!spendWeeks.has(w)) continue;

    const rel = releasedAt(schedule, w);
    const { pulls, guaranteedEpic } = spend(ujc);
    ujc = 0;

    // 100연뽑 확정 에픽 파츠 — 가장 많이 모은 세트에 채운다
    for (let i = 0; i < guaranteedEpic; i++) {
      const t = bestSet("epic", rel.epic);
      let placed = false;
      for (let p = 0; p < PARTS; p++) {
        if (!owned.epic.has(`${t}:${p}`)) { owned.epic.add(`${t}:${p}`); placed = true; break; }
      }
      if (!placed) shards += SHARD.epic;
    }

    for (let i = 0; i < pulls; i++) {
      pity++;
      let tier;
      if (pity >= 20) { tier = "epic"; pity = 0; }
      else {
        const r = Math.random() * 100;
        if (r < 50) tier = "common";
        else if (r < 80) tier = "magic";
        else if (r < 95) tier = "rare";
        else if (r < 99) { tier = "epic"; pity = 0; }
        else { tier = "legendary"; pity = 0; }
      }
      const poolOf = { magic: rel.magic, rare: rel.rare, epic: rel.epic, legendary: rel.legend };
      const key = tier === "common"
        ? `${Math.floor(Math.random() * COMMON_POOL)}`
        : `${Math.floor(Math.random() * poolOf[tier])}:${Math.floor(Math.random() * PARTS)}`;
      if (owned[tier].has(key)) shards += SHARD[tier];
      else owned[tier].add(key);
    }

    // 조각 소비: 에픽 타깃 완성 우선, 남으면 레전더리
    for (const [tier, cost] of [["epic", EPIC_COST], ["legendary", LEGEND_COST]]) {
      const pool = tier === "epic" ? rel.epic : rel.legend;
      const t = bestSet(tier, pool);
      for (let p = 0; p < PARTS && shards >= cost; p++) {
        if (!owned[tier].has(`${t}:${p}`)) { owned[tier].add(`${t}:${p}`); shards -= cost; }
      }
    }

    if (w === SEASON0_END || w === weeks) {
      const full = (tier, pool) => {
        let n = 0;
        const from = targetMode === "fixed" ? 0 : 0;
        const to = targetMode === "fixed" ? 1 : pool; // fixed는 0번 세트만 본다
        for (let s = from; s < to; s++) {
          let c = 0;
          for (let p = 0; p < PARTS; p++) if (owned[tier].has(`${s}:${p}`)) c++;
          if (c === PARTS) n++;
        }
        return n;
      };
      snapshots[w] = {
        epicSets: full("epic", rel.epic),
        legendSets: full("legendary", rel.legend),
        shards,
      };
    }
  }
  return snapshots;
}

function report(label, opts, N = 3000) {
  let e0 = 0, l0 = 0, eEnd = 0, lEnd = 0, anyE0 = 0, anyLEnd = 0;
  for (let i = 0; i < N; i++) {
    const s = simulate({ ...opts, weeks: YEAR_HALF });
    const a = s[SEASON0_END], b = s[YEAR_HALF];
    e0 += a.epicSets; l0 += a.legendSets; if (a.epicSets >= 1) anyE0++;
    eEnd += b.epicSets; lEnd += b.legendSets; if (b.legendSets >= 1) anyLEnd++;
  }
  console.log(
    `  ${label.padEnd(22)} | 시즌0말 에픽 ${(e0 / N).toFixed(1)}세트(1개↑ ${(anyE0 / N * 100).toFixed(0)}%) ` +
    `레전 ${(l0 / N).toFixed(2)}세트 | 1년반 에픽 ${(eEnd / N).toFixed(1)}세트 레전 ${(lEnd / N).toFixed(2)}세트(1개↑ ${(anyLEnd / N * 100).toFixed(0)}%)`
  );
}

console.log("분산 출시 시뮬 — v5 카탈로그(에픽 10세트/레전더리 5세트) 기준\n");
console.log("원장 목표: 연말에 에픽 하나 / 1년 반이면 레전더리 하나\n");

// 모델 검증: 기존 시뮬(고정 타깃 1세트)과 같은 가정으로 돌리면 재현되는가?
console.log("─ [모델 검증] 전량 즉시 출시, 타깃 선택 방식만 바꿔서 ─");
report("고정 타깃 1세트", { startUjc: 0, weeklyUjc: 10, schedule: SCHEDULES["전량 즉시 출시"], targetMode: "fixed" });
report("갈아타기(greedy)", { startUjc: 0, weeklyUjc: 10, schedule: SCHEDULES["전량 즉시 출시"], targetMode: "greedy" });
console.log("  ↑ 기존 시뮬레이션-가챠경제.js는 '고정 타깃' 가정 (1년 반 레전더리 ~40%)\n");

for (const [name, schedule] of Object.entries(SCHEDULES)) {
  const open = schedule[0];
  const dots = COMMON_POOL + 5 * (open.magic + open.rare + open.epic + open.legend);
  console.log(`■ ${name}  (오픈 도트 ${dots}종)`);
  report("기존생 주10+재량3", { startUjc: 250, weeklyUjc: 13, schedule });
  report("신규생 주10+재량3", { startUjc: 0, weeklyUjc: 13, schedule });
  console.log();
}

console.log("── 결론 ──");
console.log("1. 6회 분산 업데이트 자체는 안전하다. 1년 반 시점 결과가 전량 출시와 사실상 같다.");
console.log("2. 단, 레전더리 5세트는 오픈에 전량 넣어야 한다. 레전더리를 나눠 내면");
console.log("   시즌0말 완성이 0.21 → 0.73세트로 3.5배 뛴다 (좁은 풀에 드랍이 집중되기 때문).");
console.log("3. 레전더리만 전량이면 에픽·레어·매직은 아무리 좁게 열어도 밸런스가 유지된다.");
console.log("   → 오픈 도트가 258종에서 83종으로 줄어든다.");
console.log("4. 절대 수치는 '갈아타기' 가정 탓에 기존 문서보다 관대하게 나온다. 일정 간");
console.log("   비교에만 쓸 것 (모델 검증 절 참고).");
