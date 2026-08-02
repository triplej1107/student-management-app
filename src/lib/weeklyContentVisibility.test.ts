import { describe, it, expect } from "vitest";
import { publishDateISO, isWeeklyContentPublished } from "./weeklyContentVisibility";

describe("publishDateISO", () => {
  it("주차(월요일) + 6일 = 그 주 일요일", () => {
    expect(publishDateISO("2026-07-27")).toBe("2026-08-02"); // 월 → 일
    expect(publishDateISO("2026-08-03")).toBe("2026-08-09");
  });

  it("월말을 넘어가도 맞다", () => {
    expect(publishDateISO("2026-06-29")).toBe("2026-07-05");
  });
});

describe("isWeeklyContentPublished", () => {
  const week = "2026-07-27"; // 공개 예정: 2026-08-02(일) 22시

  it("공개일 이전에는 감춘다", () => {
    expect(isWeeklyContentPublished(week, "2026-08-01", 23)).toBe(false);
    expect(isWeeklyContentPublished(week, "2026-07-27", 22)).toBe(false);
  });

  it("공개일 당일이라도 22시 전이면 아직 감춘다", () => {
    expect(isWeeklyContentPublished(week, "2026-08-02", 0)).toBe(false);
    expect(isWeeklyContentPublished(week, "2026-08-02", 21)).toBe(false);
  });

  it("공개일 22시 정각부터 공개한다", () => {
    expect(isWeeklyContentPublished(week, "2026-08-02", 22)).toBe(true);
    expect(isWeeklyContentPublished(week, "2026-08-02", 23)).toBe(true);
  });

  it("공개일이 지난 주차는 시각과 무관하게 공개", () => {
    expect(isWeeklyContentPublished(week, "2026-08-03", 0)).toBe(true);
    expect(isWeeklyContentPublished("2026-07-20", "2026-08-02", 9)).toBe(true);
  });
});
