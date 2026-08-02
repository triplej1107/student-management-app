// 시즌0 오픈 풀 축소안 비교 (2026-08-02)
//
// 왜 필요한가: v4 카탈로그는 50세트 250종인데 개강(8/22)까지 전량 도트 제작이
// 불가능하다. "그럼 몇 종만 먼저 내도 되나?"에 답하려면 축소가 경제에 주는
// 영향을 봐야 한다. 결론은 설계-아이템카탈로그.md §6 참고.
//
// 핵심: 뽑기 풀의 '희석'이 이 경제를 지탱하는 장치다. 에픽·레전더리 세트 수를
// 줄이면 드랍이 타깃 세트에 집중돼 완성률이 급등하고, 하위 등급을 줄이면
// 중복이 늘어 조각 수입이 급등한다. 둘 다 밸런스를 관대한 쪽으로 무너뜨린다.
//
// 실행: node 시뮬레이션-오픈풀.js

const { execFileSync } = require("node:child_process");
const path = require("node:path");

const SIM = path.join(__dirname, "시뮬레이션-가챠경제.js");

// 원장 목표: "올해 초부터 다닌 학생이 연말에 에픽 하나", "1년 반이면 레전더리"
// 전량 출시(250종) 기준선 = 신규생 연말 에픽 ~70% / 1년 반 레전더리 ~40%
const CASES = [
  { label: "전량 출시 (기준선)", sets: [11, 5, 15, 15], cost: [100, 500] },
  { label: "매직·레어만 축소", sets: [11, 5, 8, 8], cost: [100, 500] },
  { label: "에픽8·레전4 + 조각가↑", sets: [8, 4, 8, 8], cost: [100, 600] },
  { label: "에픽6·레전3 + 조각가↑↑", sets: [6, 3, 8, 8], cost: [150, 800] },
  { label: "에픽6·레전5 + 조각가↑", sets: [6, 5, 8, 8], cost: [130, 700] },
  { label: "⚠ 1세트씩만 (붕괴 예시)", sets: [1, 1, 3, 4], cost: [100, 500] },
];

function run(c) {
  const [EPIC_SETS, LEGEND_SETS, RARE_SETS, MAGIC_SETS] = c.sets;
  const [EPIC_COST, LEGEND_COST] = c.cost;
  const COMMON_POOL = c.common ?? 20; // v4 일반 4세트 = 20종
  const out = execFileSync("node", [SIM], {
    encoding: "utf8",
    env: {
      ...process.env,
      EPIC_SETS, LEGEND_SETS, RARE_SETS, MAGIC_SETS, COMMON_POOL, EPIC_COST, LEGEND_COST,
    },
  });
  // 100연뽑 확정 = 에픽 (확정안) 구간만 읽는다
  const tail = out.slice(out.indexOf("[수정안]"));
  const pick = (needle) => {
    const line = tail.split("\n").find((l) => l.startsWith(needle));
    const m = line && line.match(/에픽세트 ([\d.]+)%.*레전세트 ([\d.]+)%/);
    return m ? { epic: +m[1], legend: +m[2] } : null;
  };
  const rookie = pick("재량지급 주3 (247");   // 신규생 연말
  const long = pick("주간10만 (780");          // 1년 반 재원
  const parts = 5 * (EPIC_SETS + LEGEND_SETS + RARE_SETS + MAGIC_SETS) + COMMON_POOL;
  return { ...c, parts, rookie, long };
}

const rows = CASES.map(run);
const pad = (s, n) => String(s).padEnd(n);

console.log("시즌0 오픈 풀 축소안 비교 — 100연뽑 확정 = 에픽 (확정안) 기준\n");
console.log(pad("출시 범위", 26) + pad("도트", 7) + pad("신규생 연말", 22) + "1년 반 재원");
console.log(pad("", 26) + pad("", 7) + pad("에픽 / 레전", 22) + "에픽 / 레전");
console.log("─".repeat(78));
for (const r of rows) {
  console.log(
    pad(r.label, 26) +
    pad(`${r.parts}종`, 7) +
    pad(`${r.rookie.epic.toFixed(1)}% / ${r.rookie.legend.toFixed(1)}%`, 22) +
    `${r.long.epic.toFixed(1)}% / ${r.long.legend.toFixed(1)}%`
  );
}
console.log("\n목표: 신규생 연말 에픽 ~70% (집공부로 따라잡을 여지) · 1년 반 레전더리 ~40%");
console.log("→ 레전더리 세트 수가 1년 반 목표를 가장 크게 흔든다. 5세트 전량 출시 권장.");
console.log("→ 에픽 세트를 줄이면 신규생 에픽이 관대해지고, 조각 가격으로는 못 잡는다.");
