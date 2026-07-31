import { describe, it, expect } from "vitest";
import { isQuietHour } from "./quietHours";

describe("isQuietHour", () => {
  it("blocks the whole night: 22시부터 8시까지", () => {
    for (const h of [22, 23, 0, 1, 3, 5, 7, 8]) {
      expect(isQuietHour(h), `${h}시는 조용시간이어야 함`).toBe(true);
    }
  });

  it("allows the day: 9시부터 21시까지", () => {
    for (const h of [9, 10, 12, 15, 18, 21]) {
      expect(isQuietHour(h), `${h}시는 알림 가능해야 함`).toBe(false);
    }
  });

  it("opens exactly at 9시, closes exactly at 22시", () => {
    expect(isQuietHour(8)).toBe(true);
    expect(isQuietHour(9)).toBe(false);
    expect(isQuietHour(21)).toBe(false);
    expect(isQuietHour(22)).toBe(true);
  });
});
