import { describe, it, expect } from "vitest";
import { isHourBeforeDue, HOUR_BEFORE_WINDOW_MINUTES } from "./reminderRules";

/** "HH:MM" → 자정 기준 분. 시험을 읽기 쉽게 하려고. */
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

describe("isHourBeforeDue", () => {
  it("한 시간쯤 남았으면 보낸다", () => {
    expect(isHourBeforeDue("18:00", at("17:00"))).toBe(true);
    expect(isHourBeforeDue("18:00", at("17:30"))).toBe(true);
  });

  it("아직 멀었으면 안 보낸다 — '1시간 뒤'라고 써놓고 두 시간 전에 울리면 안 된다", () => {
    expect(isHourBeforeDue("18:00", at("16:00"))).toBe(false);
    // 예전 기준(90분)이었다면 이게 통과했다.
    expect(isHourBeforeDue("18:00", at("16:40"))).toBe(false);
  });

  it("이미 지난 일정은 안 보낸다", () => {
    expect(isHourBeforeDue("18:00", at("18:01"))).toBe(false);
    expect(isHourBeforeDue("18:00", at("19:00"))).toBe(false);
  });

  it("시각에 딱 맞아도 보낸다 — 한 번 놓치면 그 알림은 영영 안 간다", () => {
    expect(isHourBeforeDue("18:00", at("18:00"))).toBe(true);
  });

  it("여유 시간의 경계", () => {
    const eventAt = at("18:00");
    expect(isHourBeforeDue("18:00", eventAt - HOUR_BEFORE_WINDOW_MINUTES)).toBe(true);
    expect(isHourBeforeDue("18:00", eventAt - HOUR_BEFORE_WINDOW_MINUTES - 1)).toBe(false);
  });

  it("시각을 못 읽으면 안 보낸다 — 모르면서 알리는 것보다 낫다", () => {
    expect(isHourBeforeDue("", at("17:00"))).toBe(false);
    expect(isHourBeforeDue("저녁", at("17:00"))).toBe(false);
    expect(isHourBeforeDue("25:00", at("17:00"))).toBe(false);
  });

  it("자정 넘긴 일정은 안 잡는다 — 조용시간이라 어차피 못 보낸다", () => {
    // 00:30 일정은 전날 23:25에 후보로 잡히지 않는다(날짜가 다르므로
    // 애초에 후보에 안 들어오지만, 시각 계산만으로도 음수가 되어 걸러진다).
    expect(isHourBeforeDue("00:30", at("23:25"))).toBe(false);
  });
});
