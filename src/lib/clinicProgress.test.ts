import { describe, it, expect } from "vitest";
import { isWeekSettled, weekStatus } from "./clinicProgress";
import type { ClinicCheck, ClinicTemplate } from "./types";

function template(over: Partial<ClinicTemplate> = {}): ClinicTemplate {
  return {
    id: 1,
    class_key: "1학년정규",
    week_start: "2026-08-03",
    month: "8월",
    round: "1주차",
    hw_labels: ["2주차 교재 다 풀기", "어휘 암기하기", "", "", "", "", ""],
    test_labels: ["23년 11월 학평", "어휘테스트", "", ""],
    updated_at: "",
    ...over,
  };
}

function check(over: Partial<ClinicCheck> = {}): ClinicCheck {
  return {
    id: 1,
    student_id: 1,
    week_start: "2026-08-03",
    hw_checks: [true, true, false, false, false, false, false],
    test_scores: [{ score: "85", total: "100" }, { score: "18", total: "20" }, {}, {}],
    staff_approved: true,
    staff_approved_by: 1,
    staff_approved_at: "",
    zongju_approved: true,
    zongju_approved_at: "",
    feedback_tags: null,
    feedback_text: null,
    feedback_updated_at: null,
    zongju_feedback_text: null,
    updated_at: "",
    ...over,
  };
}

describe("isWeekSettled", () => {
  it("숙제·테스트 다 채우고 종주T 최종결재까지 나면 끝난 주", () => {
    expect(isWeekSettled(template(), check())).toBe(true);
  });

  it("숙제가 하나라도 비면 안 끝났다", () => {
    expect(isWeekSettled(template(), check({ hw_checks: [true, false, false, false, false, false, false] }))).toBe(
      false
    );
  });

  it("테스트 점수가 비면 안 끝났다", () => {
    expect(isWeekSettled(template(), check({ test_scores: [{ score: "85" }, {}, {}, {}] }))).toBe(false);
  });

  it("조교 결재만으로는 안 끝났다 — 종주T 최종결재까지 나야 밀림에서 빠진다", () => {
    expect(isWeekSettled(template(), check({ zongju_approved: false }))).toBe(false);
  });

  it("아무 기록도 없으면 안 끝났다", () => {
    expect(isWeekSettled(template(), undefined)).toBe(false);
  });

  it("라벨이 빈 칸은 안 세다 — 원본에 없는 숙제를 요구하면 영원히 안 끝난다", () => {
    const onlyOneHw = template({
      hw_labels: ["교재 풀기", "", "", "", "", "", ""],
      test_labels: ["", "", "", ""],
    });
    const done = check({
      hw_checks: [true, false, false, false, false, false, false],
      test_scores: [{}, {}, {}, {}],
    });
    expect(isWeekSettled(onlyOneHw, done)).toBe(true);
  });
});

describe("weekStatus", () => {
  it("끝난 주는 초록", () => {
    expect(weekStatus(template(), check())).toBe("done");
  });

  it("안 끝난 주는 빨강", () => {
    expect(weekStatus(template(), check({ zongju_approved: false }))).toBe("todo");
  });

  it("그 반에 그 주 원본이 없으면 색 없음 — 할 일이 없던 주를 빨갛게 칠하면 안 된다", () => {
    expect(weekStatus(undefined, undefined)).toBe("none");
    expect(weekStatus(undefined, check())).toBe("none");
  });

  it("입학 전 주차도 색 없음 — 이번 주에 처음 온 학생이 몇 달치 빨강이 되면 안 된다", () => {
    expect(weekStatus(template(), undefined, { enrolled: false })).toBe("none");
  });

  it("입학 후면 평소대로 판정한다", () => {
    expect(weekStatus(template(), check(), { enrolled: true })).toBe("done");
    expect(weekStatus(template(), undefined, { enrolled: true })).toBe("todo");
  });
});
