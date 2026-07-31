import { describe, it, expect, afterEach, vi } from "vitest";
import { getToday } from "./today";
import { toISODate } from "./weeks";

afterEach(() => {
  vi.useRealTimers();
});

/** 이 테스트는 UTC 환경(vitest.config.mts에서 TZ=UTC)에서 도는 게 핵심이다 —
 * Vercel 서버와 같은 조건이라야, 한국 시간 자정~오전 9시 사이에만 하루가
 * 어긋나던 실제 버그를 잡아낸다. */
describe("getToday (KST 기준)", () => {
  it("한국 토요일 새벽 2시를 토요일로 본다 (UTC로는 아직 금요일 저녁)", () => {
    // 2026-07-31T17:50:00Z = 2026-08-01 02:50 KST (토)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T17:50:00Z"));

    const { today, dayLabel } = getToday();
    expect(dayLabel).toBe("토");
    expect(toISODate(today)).toBe("2026-08-01");
  });

  it("한국 오전 9시 이후에는 UTC와 날짜가 같아 그대로 맞는다", () => {
    // 2026-08-01T01:00:00Z = 2026-08-01 10:00 KST (토)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T01:00:00Z"));

    const { today, dayLabel } = getToday();
    expect(dayLabel).toBe("토");
    expect(toISODate(today)).toBe("2026-08-01");
  });

  it("한국 자정 직후에도 그날 날짜로 넘어간다", () => {
    // 2026-07-31T15:10:00Z = 2026-08-01 00:10 KST (토)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T15:10:00Z"));

    expect(toISODate(getToday().today)).toBe("2026-08-01");
  });
});
