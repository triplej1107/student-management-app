import { describe, it, expect } from "vitest";
import { firstClinicWeekStart, isWeekOnOrAfterEnrollment } from "./enrollmentWeek";
import { toISODate } from "./weeks";

describe("firstClinicWeekStart", () => {
  it("첫수업일이 속한 주의 월요일을 돌려준다", () => {
    // 2026-08-05는 수요일 → 그 주 월요일은 2026-08-03
    expect(toISODate(firstClinicWeekStart("2026-08-05")!)).toBe("2026-08-03");
  });

  it("첫수업일이 월요일이면 그 날 그대로", () => {
    expect(toISODate(firstClinicWeekStart("2026-08-03")!)).toBe("2026-08-03");
  });

  it("첫수업일이 일요일이면 그 주(직전 월요일)로 묶인다", () => {
    // 2026-08-09는 일요일 → 같은 주 월요일 2026-08-03
    expect(toISODate(firstClinicWeekStart("2026-08-09")!)).toBe("2026-08-03");
  });

  it("첫수업일이 없으면 null", () => {
    expect(firstClinicWeekStart(null)).toBeNull();
    expect(firstClinicWeekStart("")).toBeNull();
  });
});

describe("isWeekOnOrAfterEnrollment", () => {
  const firstLesson = "2026-08-05"; // 첫 클리닉 주차 = 2026-08-03

  it("첫 주차 이전은 제외한다 — 최서준이 7월 3주차 밀림으로 잡히던 문제", () => {
    expect(isWeekOnOrAfterEnrollment(new Date(2026, 6, 13), firstLesson)).toBe(false);
    expect(isWeekOnOrAfterEnrollment(new Date(2026, 6, 27), firstLesson)).toBe(false);
  });

  it("첫 주차 당주부터는 포함한다", () => {
    expect(isWeekOnOrAfterEnrollment(new Date(2026, 7, 3), firstLesson)).toBe(true);
  });

  it("첫 주차 이후도 포함한다", () => {
    expect(isWeekOnOrAfterEnrollment(new Date(2026, 7, 10), firstLesson)).toBe(true);
  });

  it("첫수업일이 없으면 기존처럼 전부 포함한다", () => {
    expect(isWeekOnOrAfterEnrollment(new Date(2020, 0, 6), null)).toBe(true);
  });
});
