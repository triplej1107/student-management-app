import { describe, it, expect } from "vitest";
import {
  finishedMessage,
  matchStudents,
  formatRemaining,
  kstTimeToISO,
  remainingSeconds,
  resumeStartAtISO,
  sortByRemaining,
  timerLevel,
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

describe("sortByRemaining", () => {
  const now = Date.parse("2026-08-06T05:00:00.000Z");
  const at = (minutesLeft: number, name: string) => ({
    name,
    startAtISO: new Date(now - (80 - minutesLeft) * 60 * 1000).toISOString(),
    durationSeconds: 80 * 60,
    pausedRemainingSeconds: null as number | null,
  });
  const state = (t: ReturnType<typeof at>) => t;

  it("적게 남은 사람이 앞으로", () => {
    const sorted = sortByRemaining([at(40, "가"), at(5, "나"), at(70, "다")], now, state);
    expect(sorted.map((t) => t.name)).toEqual(["나", "가", "다"]);
  });

  it("끝난 타이머가 맨 앞 — 제일 먼저 걷어야 한다", () => {
    const sorted = sortByRemaining([at(5, "가"), at(-3, "끝남"), at(1, "나")], now, state);
    expect(sorted.map((t) => t.name)).toEqual(["끝남", "나", "가"]);
  });

  it("정지된 타이머는 멈춰둔 남은 시간으로 줄을 선다", () => {
    const paused = { ...at(70, "정지중"), pausedRemainingSeconds: 60 };
    const sorted = sortByRemaining([at(5, "가"), paused], now, state);
    expect(sorted.map((t) => t.name)).toEqual(["정지중", "가"]);
  });

  it("남은 시간이 같으면 먼저 등록한 순서를 지킨다", () => {
    const sorted = sortByRemaining([at(10, "먼저"), at(10, "나중")], now, state);
    expect(sorted.map((t) => t.name)).toEqual(["먼저", "나중"]);
  });

  it("원본 배열을 건드리지 않는다", () => {
    const input = [at(40, "가"), at(5, "나")];
    sortByRemaining(input, now, state);
    expect(input.map((t) => t.name)).toEqual(["가", "나"]);
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

describe("matchStudents", () => {
  const students = [
    { name: "김지우", code: "72331", detail: "가락고 1학년" },
    { name: "박지우", code: "10011", detail: "배명고 2학년" },
    { name: "이순신", code: "48641", detail: "배명고 2학년" },
    { name: "지우개", code: "55512", detail: "" },
  ];

  it("안 쳤으면 아무것도 안 띄운다", () => {
    expect(matchStudents(students, "")).toEqual([]);
    expect(matchStudents(students, "   ")).toEqual([]);
  });

  it("이름 일부로 찾는다", () => {
    expect(matchStudents(students, "지우").map((s) => s.name)).toEqual([
      "지우개",
      "김지우",
      "박지우",
    ]);
  });

  it("그 글자로 시작하는 사람이 위로 온다", () => {
    expect(matchStudents(students, "김").map((s) => s.name)).toEqual(["김지우"]);
  });

  it("학번으로도 찾는다", () => {
    expect(matchStudents(students, "48641").map((s) => s.name)).toEqual(["이순신"]);
  });

  it("이름을 정확히 다 쳤으면 목록을 닫는다", () => {
    expect(matchStudents(students, "이순신")).toEqual([]);
  });

  it("동명이인이면 다 친 뒤에도 계속 보여준다", () => {
    // 이름만으로는 누군지 모르니 학번을 보고 골라야 한다.
    const withTwin = [...students, { name: "김지우", code: "99999", detail: "배명고 2학년" }];
    expect(matchStudents(withTwin, "김지우").map((s) => s.code)).toEqual(["72331", "99999"]);
  });

  it("개수를 제한한다", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `학생${i}`, code: `${i}`, detail: "" }));
    expect(matchStudents(many, "학생")).toHaveLength(6);
  });
});

describe("timerLevel", () => {
  it("10분 넘게 남았으면 평소 색", () => {
    expect(timerLevel(11 * 60)).toBe("normal");
    expect(timerLevel(600.5)).toBe("normal");
  });

  it("10분 이하면 노란 칸", () => {
    expect(timerLevel(10 * 60)).toBe("warn");
    expect(timerLevel(5 * 60 + 1)).toBe("warn");
  });

  it("5분 이하면 글자가 빨개진다 (칸은 아직 노랑)", () => {
    expect(timerLevel(5 * 60)).toBe("urgent");
    expect(timerLevel(61)).toBe("urgent");
  });

  it("1분 이하면 칸까지 빨개진다", () => {
    expect(timerLevel(60)).toBe("critical");
    expect(timerLevel(1)).toBe("critical");
  });

  it("시간이 다 되면 종료", () => {
    expect(timerLevel(0)).toBe("done");
    expect(timerLevel(-5)).toBe("done");
  });
});

describe("finishedMessage", () => {
  it("시험 이름이 있으면 같이 넣는다", () => {
    expect(finishedMessage("이순신", "모의고사 4회차")).toBe(
      "이순신 학생 모의고사 4회차 시간이 끝났습니다!"
    );
  });

  it("시험 이름이 없으면 이름만", () => {
    expect(finishedMessage("이순신", null)).toBe("이순신 학생 시간이 끝났습니다!");
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
