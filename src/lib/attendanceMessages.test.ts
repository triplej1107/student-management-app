import { describe, it, expect } from "vitest";
import { buildLateMessage, buildAutoAbsentMessage } from "./attendanceMessages";

describe("buildLateMessage", () => {
  it("includes the day, time, and reason", () => {
    expect(buildLateMessage("목", "15:00")).toBe(
      "목요일 15:00 클리닉인데 아직 출석하지 않아 지각으로 처리됐어요."
    );
  });
});

describe("buildAutoAbsentMessage", () => {
  it("emphasizes that no makeup time was arranged", () => {
    expect(buildAutoAbsentMessage("수", "20:00")).toBe(
      "수요일 20:00 클리닉, 시간 조정 없이 결석으로 처리됐어요."
    );
  });
});
