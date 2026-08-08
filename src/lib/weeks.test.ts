import { describe, it, expect, afterEach, vi } from "vitest";
import {
  toISODate,
  dayLabelOf,
  kstToday,
  isPastClinicTime,
  nextDayISO,
  kstTimeHHMM,
  makeupDateISO,
} from "./weeks";

afterEach(() => {
  vi.useRealTimers();
});

describe("toISODate", () => {
  it("pads month/day and uses local time", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("makeupDateISO", () => {
  it("maps a weekday within the same week as the original session", () => {
    // 8/7은 금요일 → 그 주 수요일은 8/5.
    expect(makeupDateISO("2026-08-07", "수")).toBe("2026-08-05");
    expect(makeupDateISO("2026-07-31", "수")).toBe("2026-07-29");
  });

  it("handles Sunday (week ends on Sunday, not starts)", () => {
    // 8/7(금)이 속한 주는 8/3(월)~8/9(일).
    expect(makeupDateISO("2026-08-07", "일")).toBe("2026-08-09");
  });

  it("returns null for an unreadable day label", () => {
    expect(makeupDateISO("2026-08-07", "")).toBeNull();
  });
});

describe("kstTimeHHMM", () => {
  it("shifts UTC to KST wall clock", () => {
    expect(kstTimeHHMM("2026-08-01T06:12:33+00:00")).toBe("15:12");
  });

  it("wraps past midnight", () => {
    // 16:30 UTC = 01:30 KST (다음 날)
    expect(kstTimeHHMM("2026-08-01T16:30:00Z")).toBe("01:30");
  });

  it("pads single digits", () => {
    expect(kstTimeHHMM("2026-08-01T00:05:00Z")).toBe("09:05");
  });
});

describe("nextDayISO", () => {
  it("returns the next day", () => {
    expect(nextDayISO("2026-08-05")).toBe("2026-08-06");
  });

  it("rolls over month end", () => {
    expect(nextDayISO("2026-08-31")).toBe("2026-09-01");
  });

  it("rolls over year end", () => {
    expect(nextDayISO("2026-12-31")).toBe("2027-01-01");
  });
});

describe("dayLabelOf", () => {
  it("maps Sunday(0) to the last day label", () => {
    // 2026-08-02 is a Sunday.
    expect(dayLabelOf(new Date(2026, 7, 2))).toBe("일");
  });

  it("maps Monday(1) to the first day label", () => {
    // 2026-08-03 is a Monday.
    expect(dayLabelOf(new Date(2026, 7, 3))).toBe("월");
  });
});

describe("isPastClinicTime / kstToday (KST wall-clock correctness)", () => {
  it("treats KST 14:30 as past a 14:00 clinic but not a 15:00 clinic", () => {
    // 2026-07-31T05:30:00Z == 2026-07-31 14:30 KST (UTC+9).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T05:30:00Z"));

    expect(isPastClinicTime("14:00")).toBe(true);
    expect(isPastClinicTime("15:00")).toBe(false);
  });

  it("resolves kstToday to the correct KST calendar date near a UTC day boundary", () => {
    // 2026-07-31T16:00:00Z == 2026-08-01 01:00 KST — already the next day in KST,
    // even though it's still 2026-07-31 in UTC. This is exactly the boundary that
    // caused a real debugging detour this session (see attendanceAuto.ts history).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T16:00:00Z"));

    expect(toISODate(kstToday())).toBe("2026-08-01");
  });

  it("returns false for an empty clinic time", () => {
    expect(isPastClinicTime("")).toBe(false);
  });

  it("여유를 주면 그만큼 더 지나야 한다 — 3분 늦은 학생을 결석으로 만들지 않으려고", () => {
    // 2026-07-31T05:15:00Z == 14:15 KST. 14:00 클리닉이 15분 지났다.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T05:15:00Z"));

    expect(isPastClinicTime("14:00")).toBe(true); // 여유 없이 보면 이미 지남
    expect(isPastClinicTime("14:00", 20)).toBe(false); // 20분 여유로 보면 아직
  });

  it("여유 시간을 넘기면 true", () => {
    // 14:25 KST — 14:00 클리닉이 25분 지났다.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T05:25:00Z"));
    expect(isPastClinicTime("14:00", 20)).toBe(true);
  });
});
