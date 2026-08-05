import { describe, it, expect, afterEach, vi } from "vitest";
import { toISODate, dayLabelOf, kstToday, isPastClinicTime, nextDayISO } from "./weeks";

afterEach(() => {
  vi.useRealTimers();
});

describe("toISODate", () => {
  it("pads month/day and uses local time", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
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
});
