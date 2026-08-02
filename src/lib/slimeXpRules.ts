// 슬라임 XP 규칙 — 순수 계산부 (DB 없음, 테스트 대상).
// DB 연동은 slimeXp.ts. 설계: game-design/CONTEXT.md.

import { parseISODate } from "./weeks";
import type { AttendanceStatus, TestScore } from "./types";
import type { SlimeStage } from "./slimeSprite";

export const XP_VALUES = {
  onTime: 50,
  late: 20,
  makeup: 30,
  hwSlot: 10,
  hwFullBonus: 30,
  testMax: 15,
  improve: 20,
};

export interface EvolveThresholds {
  hatch: number;
  teen: number;
  awake: number;
  job: number;
}

export interface XpEventDraft {
  kind: string;
  sourceKey: string;
  base: number;
  note: string;
}

function parseRate(t: TestScore | undefined): number | null {
  if (!t) return null;
  const score = Number(t.score);
  const total = Number(t.total);
  if (!t.score || !t.total || !Number.isFinite(score) || !Number.isFinite(total) || total <= 0) return null;
  return Math.min(1, Math.max(0, score / total));
}

export interface WeekInputs {
  weekStartISO: string;
  seasonStartISO: string;
  attendance: { dateISO: string; status: AttendanceStatus }[];
  hwChecks: boolean[] | null;
  testScores: TestScore[] | null;
  prevTestScores: TestScore[] | null;
}

/** 한 주의 원본 데이터 → XP 이벤트 목록 (배율 적용 전). */
export function computeWeekEvents(inp: WeekInputs): XpEventDraft[] {
  const w = inp.weekStartISO;
  const events: XpEventDraft[] = [];

  for (const a of inp.attendance) {
    if (a.dateISO < inp.seasonStartISO) continue; // 시즌 시작 전 출결은 제외
    if (a.status === "출석") events.push({ kind: "attendance", sourceKey: `${w}|att:${a.dateISO}`, base: XP_VALUES.onTime, note: "클리닉 정시 출석" });
    else if (a.status === "지각") events.push({ kind: "attendance", sourceKey: `${w}|att:${a.dateISO}`, base: XP_VALUES.late, note: "클리닉 지각" });
    else if (a.status === "조정") events.push({ kind: "attendance", sourceKey: `${w}|att:${a.dateISO}`, base: XP_VALUES.makeup, note: "클리닉 조정" });
    // 결석은 0 — 이벤트 없음
  }

  const hw = inp.hwChecks ?? [];
  let hwDone = 0;
  hw.forEach((checked, i) => {
    if (!checked) return;
    hwDone += 1;
    events.push({ kind: "homework", sourceKey: `${w}|hw:${i}`, base: XP_VALUES.hwSlot, note: `숙제 ${i + 1}` });
  });
  if (hw.length === 7 && hwDone === 7) {
    events.push({ kind: "homework", sourceKey: `${w}|hwbonus`, base: XP_VALUES.hwFullBonus, note: "숙제 7/7 완수" });
  }

  const tests = inp.testScores ?? [];
  tests.forEach((t, i) => {
    const rate = parseRate(t);
    if (rate === null) return;
    const base = Math.round(rate * XP_VALUES.testMax);
    if (base > 0) events.push({ kind: "test", sourceKey: `${w}|test:${i}`, base, note: `테스트 ${i + 1} (${Math.round(rate * 100)}%)` });
    const prevRate = parseRate(inp.prevTestScores?.[i]);
    if (prevRate !== null && rate > prevRate + 0.02) {
      events.push({ kind: "improve", sourceKey: `${w}|improve:${i}`, base: XP_VALUES.improve, note: `테스트 ${i + 1} 지난주 대비 향상` });
    }
  });

  return events;
}

/** 재원 학기 수 = first_lesson_date 이후 지난 반기 경계(3/1, 9/1) 횟수. 학기당 +10%, 최대 +50%. */
export function tenureMultiplier(firstLessonISO: string | null, weekStart: Date): number {
  if (!firstLessonISO) return 1;
  const start = parseISODate(firstLessonISO);
  if (start > weekStart) return 1;
  let count = 0;
  for (let y = start.getFullYear(); y <= weekStart.getFullYear(); y++) {
    for (const boundary of [new Date(y, 2, 1), new Date(y, 8, 1)]) {
      if (boundary > start && boundary <= weekStart) count += 1;
    }
  }
  return 1 + Math.min(5, count) * 0.1;
}

/** 연속 개근 주수 → 배율. 개근 주 = 지각·결석 없이 정시 출석이 1회 이상 있는 주. */
export function streakMultiplier(consecutivePerfectWeeks: number): number {
  if (consecutivePerfectWeeks >= 4) return 1.25;
  if (consecutivePerfectWeeks >= 2) return 1.1;
  return 1;
}

/** 이번 주를 포함해 뒤로 이어지는 개근 주수를 센다. weeksDesc는 이번 주부터 과거순. */
export function countPerfectStreak(weeksDesc: AttendanceStatus[][]): number {
  let n = 0;
  for (const statuses of weeksDesc) {
    const perfect = statuses.includes("출석") && !statuses.includes("지각") && !statuses.includes("결석");
    if (!perfect) break;
    n += 1;
  }
  return n;
}

const STAGE_ORDER: SlimeStage[] = ["egg", "baby", "teen", "awake"];

/** 누적 XP 기준 단계 — 절대 후퇴하지 않는다. 전직(job)은 별도 UI로 처리 예정이라 여기선 awake까지. */
export function stageForXp(xp: number, th: EvolveThresholds, current: SlimeStage): SlimeStage {
  const target: SlimeStage = xp >= th.awake ? "awake" : xp >= th.teen ? "teen" : xp >= th.hatch ? "baby" : "egg";
  const cur = STAGE_ORDER.indexOf(current) === -1 ? 0 : STAGE_ORDER.indexOf(current);
  return STAGE_ORDER[Math.max(cur, STAGE_ORDER.indexOf(target))];
}
