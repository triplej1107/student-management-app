import { describe, expect, it } from "vitest";
import {
  computeWeekEvents,
  countPerfectStreak,
  stageForXp,
  streakMultiplier,
  tenureMultiplier,
  XP_VALUES,
  type WeekInputs,
} from "./slimeXpRules";

const TH = { hatch: 150, teen: 1200, awake: 3500, job: 6000 };

function baseInputs(over: Partial<WeekInputs> = {}): WeekInputs {
  return {
    weekStartISO: "2026-08-24",
    seasonStartISO: "2026-08-22",
    attendance: [],
    hwChecks: null,
    testScores: null,
    prevTestScores: null,
    ...over,
  };
}

describe("computeWeekEvents", () => {
  it("출석 상태별 XP — 결석은 이벤트 없음", () => {
    const events = computeWeekEvents(
      baseInputs({
        attendance: [
          { dateISO: "2026-08-24", status: "출석" },
          { dateISO: "2026-08-25", status: "지각" },
          { dateISO: "2026-08-26", status: "조정" },
          { dateISO: "2026-08-27", status: "결석" },
        ],
      })
    );
    expect(events.map((e) => e.base)).toEqual([XP_VALUES.onTime, XP_VALUES.late, XP_VALUES.makeup]);
  });

  it("시즌 시작 전 날짜의 출결은 제외한다", () => {
    const events = computeWeekEvents(
      baseInputs({
        weekStartISO: "2026-08-17",
        attendance: [
          { dateISO: "2026-08-20", status: "출석" }, // 시즌 전
          { dateISO: "2026-08-22", status: "출석" }, // 시즌 첫날
        ],
      })
    );
    expect(events).toHaveLength(1);
    expect(events[0].sourceKey).toContain("2026-08-22");
  });

  it("숙제 7/7이면 보너스가 붙는다", () => {
    const all = computeWeekEvents(baseInputs({ hwChecks: [true, true, true, true, true, true, true] }));
    expect(all.filter((e) => e.kind === "homework")).toHaveLength(8);
    expect(all.some((e) => e.sourceKey.endsWith("|hwbonus"))).toBe(true);
    const six = computeWeekEvents(baseInputs({ hwChecks: [true, true, true, true, true, true, false] }));
    expect(six.some((e) => e.sourceKey.endsWith("|hwbonus"))).toBe(false);
  });

  it("테스트는 득점률 비례, 향상 시 보너스", () => {
    const events = computeWeekEvents(
      baseInputs({
        testScores: [{ score: "8", total: "10" }, { score: "5", total: "10" }, {}, {}],
        prevTestScores: [{ score: "6", total: "10" }, { score: "5", total: "10" }, {}, {}],
      })
    );
    const test0 = events.find((e) => e.sourceKey.endsWith("|test:0"));
    expect(test0?.base).toBe(Math.round(0.8 * XP_VALUES.testMax));
    // 슬롯0은 60%→80% 향상, 슬롯1은 동일 → 향상 보너스는 슬롯0만
    expect(events.filter((e) => e.kind === "improve")).toHaveLength(1);
    expect(events.find((e) => e.kind === "improve")?.sourceKey).toContain("improve:0");
  });

  it("잘못된 점수 입력(빈 값, 0점 만점)은 무시한다", () => {
    const events = computeWeekEvents(
      baseInputs({ testScores: [{ score: "5", total: "0" }, { score: "abc", total: "10" }, {}, {}] })
    );
    expect(events).toHaveLength(0);
  });
});

describe("배율", () => {
  it("근속 배율 — 반기 경계 횟수당 +10%, 최대 +50%", () => {
    const week = new Date(2026, 7, 24); // 2026-08-24
    expect(tenureMultiplier(null, week)).toBe(1);
    expect(tenureMultiplier("2026-08-01", week)).toBe(1); // 경계 안 지남
    expect(tenureMultiplier("2026-02-15", week)).toBeCloseTo(1.1); // 3/1 한 번
    expect(tenureMultiplier("2025-08-20", week)).toBeCloseTo(1.2); // 25/9/1, 26/3/1
    expect(tenureMultiplier("2020-01-01", week)).toBeCloseTo(1.5); // 상한
  });

  it("스트릭 배율", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(1)).toBe(1);
    expect(streakMultiplier(2)).toBe(1.1);
    expect(streakMultiplier(4)).toBe(1.25);
  });

  it("연속 개근 주수 — 지각·결석이 끼면 끊긴다", () => {
    expect(countPerfectStreak([["출석"], ["출석"], ["지각", "출석"], ["출석"]])).toBe(2);
    expect(countPerfectStreak([["지각"], ["출석"]])).toBe(0);
    expect(countPerfectStreak([[], ["출석"]])).toBe(0); // 출석 없는 주는 개근 아님
  });
});

describe("stageForXp", () => {
  it("임계값 순서대로 진화한다", () => {
    expect(stageForXp(0, TH, "egg")).toBe("egg");
    expect(stageForXp(150, TH, "egg")).toBe("baby");
    expect(stageForXp(1200, TH, "egg")).toBe("teen");
    expect(stageForXp(3500, TH, "baby")).toBe("awake");
  });

  it("XP가 줄어도 단계는 후퇴하지 않는다", () => {
    expect(stageForXp(100, TH, "teen")).toBe("teen");
  });
});
