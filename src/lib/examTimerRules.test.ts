import { describe, it, expect } from "vitest";
import {
  formatRemaining,
  kstTimeToISO,
  remainingSeconds,
  resumeStartAtISO,
  warningMessage,
} from "./examTimerRules";

describe("formatRemaining", () => {
  it("원장님 표기대로 60분이 넘어도 분으로 쭉 센다", () => {
    expect(formatRemaining(74 * 60 + 20)).toBe("74:20");
    expect(formatRemaining(79 * 60 + 20)).toBe("79:20");
    expect(formatRemaining(44 * 60 + 20)).toBe("44:20");
  });

  it("한 자리 분/초도 두 자리로 맞춘다", () => {
    expect(formatRemaining(65)).toBe("01:05");
  });

  it("시간이 지나면 0에서 멈춘다", () => {
    expect(formatRemaining(0)).toBe("00:00");
    expect(formatRemaining(-30)).toBe("00:00");
  });
});

describe("remainingSeconds", () => {
  const start = "2026-08-06T04:30:00.000Z"; // KST 13:30

  it("진행 중이면 시작 시각에서 흘러간 만큼 뺀다", () => {
    const now = Date.parse(start) + 20 * 60 * 1000;
    expect(
      remainingSeconds({ startAtISO: start, durationSeconds: 80 * 60, pausedRemainingSeconds: null }, now)
    ).toBe(60 * 60);
  });

  it("정지 중이면 시간이 흘러도 그대로다", () => {
    const state = { startAtISO: start, durationSeconds: 80 * 60, pausedRemainingSeconds: 1234 };
    expect(remainingSeconds(state, Date.parse(start))).toBe(1234);
    expect(remainingSeconds(state, Date.parse(start) + 99 * 60 * 1000)).toBe(1234);
  });
});

describe("resumeStartAtISO", () => {
  it("다시 시작해도 남은 시간이 그대로 이어진다", () => {
    const now = Date.parse("2026-08-06T05:00:00.000Z");
    const state = {
      startAtISO: "2026-08-06T04:30:00.000Z",
      durationSeconds: 80 * 60,
      pausedRemainingSeconds: 25 * 60,
    };
    const resumed = resumeStartAtISO(state, now);
    const after = remainingSeconds(
      { startAtISO: resumed, durationSeconds: 80 * 60, pausedRemainingSeconds: null },
      now
    );
    expect(after).toBe(25 * 60);
  });
});

describe("kstTimeToISO", () => {
  it("KST 벽시계 시각을 실제 시각으로 (서버가 UTC라도)", () => {
    expect(kstTimeToISO("2026-08-06", "13:30")).toBe("2026-08-06T04:30:00.000Z");
    expect(kstTimeToISO("2026-08-06", "9:05")).toBe("2026-08-06T00:05:00.000Z");
  });

  it("자정 근처는 전날 UTC로 넘어간다", () => {
    expect(kstTimeToISO("2026-08-06", "00:00")).toBe("2026-08-05T15:00:00.000Z");
  });

  it("형식이 틀리면 null", () => {
    expect(kstTimeToISO("2026-08-06", "1330")).toBeNull();
    expect(kstTimeToISO("2026-08-06", "25:00")).toBeNull();
    expect(kstTimeToISO("2026-08-06", "13:70")).toBeNull();
    expect(kstTimeToISO("2026-08-06", "")).toBeNull();
  });
});

describe("warningMessage", () => {
  it("시험 이름이 있으면 같이 넣는다", () => {
    expect(warningMessage("이순신", "모의고사 4회차")).toBe(
      "이순신 학생 모의고사 4회차 10분 남았습니다!"
    );
  });

  it("시험 이름이 없으면 이름만", () => {
    expect(warningMessage("이순신", null)).toBe("이순신 학생 10분 남았습니다!");
    expect(warningMessage("이순신", "  ")).toBe("이순신 학생 10분 남았습니다!");
  });
});
