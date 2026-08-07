import { describe, it, expect } from "vitest";
import {
  LATE_AFTER_MINUTES,
  MISSING_AFTER_MINUTES,
  isSyncStale,
  lectureRosterForDay,
  minutesOfTime,
  missingMessage,
  missingStudents,
  needsMakeup,
  isDutyNagTime,
  shouldFillClinicFromKiosk,
  statusForCheckIn,
  type LectureRosterEntry,
} from "./lectureRules";

describe("minutesOfTime", () => {
  it("HH:MM을 분으로", () => {
    expect(minutesOfTime("09:00")).toBe(540);
    expect(minutesOfTime("9:05")).toBe(545);
    expect(minutesOfTime("19:30")).toBe(1170);
  });

  it("못 읽는 값은 null", () => {
    expect(minutesOfTime("9시")).toBeNull();
    expect(minutesOfTime("")).toBeNull();
    expect(minutesOfTime("25:00")).toBeNull();
    expect(minutesOfTime("09:70")).toBeNull();
  });
});

describe("lectureRosterForDay", () => {
  const students = [
    { id: 1, student_code: "56501", name: "김민찬", class_day: "일", class_time: "19:00" },
    { id: 2, student_code: "77332", name: "김연우", class_day: "토", class_time: "09:00" },
    { id: 3, student_code: "69122", name: "최민규", class_day: "일", class_time: "19:00" },
    // 시간이 비었으면 판정할 수 없으니 뺀다.
    { id: 4, student_code: "82272", name: "김도원", class_day: "일", class_time: null },
    // 요일 자체가 없는 학생.
    { id: 5, student_code: "92581", name: "김수환", class_day: null, class_time: "19:00" },
  ];

  it("그 요일 학생만 추린다", () => {
    expect(lectureRosterForDay(students, "일").map((e) => e.studentId)).toEqual([1, 3]);
    expect(lectureRosterForDay(students, "토").map((e) => e.studentId)).toEqual([2]);
  });

  it("시각을 모르는 학생은 뺀다 — 모르는 채로 결석 알림을 보내면 안 된다", () => {
    expect(lectureRosterForDay(students, "일").map((e) => e.studentId)).not.toContain(4);
  });

  it("강의가 없는 요일이면 빈 목록", () => {
    expect(lectureRosterForDay(students, "수")).toEqual([]);
  });

  describe("그 주만 시간을 옮긴 학생", () => {
    const moved = new Map([[1, { studentId: 1, movedDay: "토", movedTime: "09:00" }]]);

    it("원래 날짜 명단에서 빠진다 — 안 그러면 애먼 결석 알림이 나간다", () => {
      expect(lectureRosterForDay(students, "일", moved).map((e) => e.studentId)).toEqual([3]);
    });

    it("옮겨간 날짜 명단에 들어간다", () => {
      const sat = lectureRosterForDay(students, "토", moved);
      expect(sat.map((e) => e.studentId)).toEqual([1, 2]);
      expect(sat.find((e) => e.studentId === 1)?.time).toBe("09:00");
    });

    it("옮긴 학생은 표시가 남는다", () => {
      const sat = lectureRosterForDay(students, "토", moved);
      expect(sat.find((e) => e.studentId === 1)?.moved).toBe(true);
      expect(sat.find((e) => e.studentId === 2)?.moved).toBe(false);
    });

    it("같은 요일 안에서 시간만 옮겨도 새 시각이 적용된다", () => {
      const sameDay = new Map([[1, { studentId: 1, movedDay: "일", movedTime: "13:00" }]]);
      const sun = lectureRosterForDay(students, "일", sameDay);
      expect(sun.find((e) => e.studentId === 1)?.time).toBe("13:00");
    });

    it("옮긴 시각을 못 읽으면 명단에서 뺀다", () => {
      const broken = new Map([[1, { studentId: 1, movedDay: "일", movedTime: "저녁" }]]);
      expect(lectureRosterForDay(students, "일", broken).map((e) => e.studentId)).toEqual([3]);
    });
  });
});

describe("statusForCheckIn", () => {
  it("정시나 조금 늦은 건 출석", () => {
    expect(statusForCheckIn("09:00", "08:52")).toBe("출석");
    expect(statusForCheckIn("09:00", "09:00")).toBe("출석");
    expect(statusForCheckIn("09:00", `09:${LATE_AFTER_MINUTES}`)).toBe("출석");
  });

  it("유예를 넘기면 지각", () => {
    expect(statusForCheckIn("09:00", "09:11")).toBe("지각");
    expect(statusForCheckIn("19:00", "19:45")).toBe("지각");
  });

  it("시각을 못 읽으면 출석으로 둔다 — 찍고 온 학생을 지각으로 몰지 않는다", () => {
    expect(statusForCheckIn("9시", "09:40")).toBe("출석");
    expect(statusForCheckIn("09:00", "")).toBe("출석");
  });
});

describe("missingStudents", () => {
  const roster: LectureRosterEntry[] = [
    { studentId: 1, studentCode: "56501", name: "김민찬", time: "19:00", moved: false },
    { studentId: 2, studentCode: "69122", name: "최민규", time: "19:00", moved: false },
    { studentId: 3, studentCode: "83621", name: "이승우", time: "13:00", moved: false },
  ];
  const at = (hhmm: string) => minutesOfTime(hhmm)!;

  it("수업 시작 전에는 아무도 안 잡는다", () => {
    // 제일 이른 반(13시)도 아직 시작 전인 시각으로 본다.
    expect(missingStudents(roster, new Set(), at("08:00"))).toEqual([]);
  });

  it("유예 시간 안에도 안 잡는다 — 키오스크 줄이 밀릴 수 있다", () => {
    expect(missingStudents(roster, new Set(), at("19:10"))).toHaveLength(1); // 13시반만
    expect(missingStudents(roster, new Set(), at("19:10")).map((e) => e.studentId)).toEqual([3]);
  });

  it("유예를 넘기면 안 찍힌 학생만 잡는다", () => {
    const now = at("19:00") + MISSING_AFTER_MINUTES;
    const missing = missingStudents(roster, new Set([1]), now);
    expect(missing.map((e) => e.studentId)).toEqual([2, 3]);
  });

  it("다 찍었으면 아무도 안 잡는다", () => {
    expect(missingStudents(roster, new Set([1, 2, 3]), at("23:00"))).toEqual([]);
  });

  it("시각이 다른 반은 각자 자기 시간 기준으로 판단한다", () => {
    // 13시반은 이미 유예를 넘겼고, 19시반은 아직 시작도 안 했다.
    const missing = missingStudents(roster, new Set(), at("13:30"));
    expect(missing.map((e) => e.studentId)).toEqual([3]);
  });
});

describe("missingMessage", () => {
  it("몇 시 수업인지 넣어준다", () => {
    expect(missingMessage("19:00")).toBe("19:00 강의 수업인데 아직 등원하지 않았어요.");
  });
});

describe("isSyncStale", () => {
  const now = Date.parse("2026-08-09T10:00:00.000Z");

  it("방금 성공했으면 멀쩡", () => {
    expect(isSyncStale("2026-08-09T09:30:00.000Z", now)).toBe(false);
  });

  it("한참 성공이 없으면 죽은 것으로 본다", () => {
    expect(isSyncStale("2026-08-09T02:00:00.000Z", now)).toBe(true);
  });

  it("한 번도 성공한 적이 없으면 죽은 것 — 처음부터 안 도는 경우가 제일 흔하다", () => {
    expect(isSyncStale(null, now)).toBe(true);
  });

  it("값이 깨져 있어도 죽은 것으로 본다", () => {
    expect(isSyncStale("몰라", now)).toBe(true);
  });
});

describe("needsMakeup", () => {
  it("결석이고 옮겨둔 일정이 없으면 보강 대상", () => {
    expect(needsMakeup("결석", false)).toBe(true);
  });

  it("보강 일정을 잡아두면 목록에서 빠진다", () => {
    expect(needsMakeup("결석", true)).toBe(false);
  });

  it("조정은 이미 갈 곳이 정해져 있어 대상이 아니다", () => {
    expect(needsMakeup("조정", false)).toBe(false);
  });

  it("출석·지각은 당연히 대상이 아니다", () => {
    expect(needsMakeup("출석", false)).toBe(false);
    expect(needsMakeup("지각", false)).toBe(false);
  });
});

describe("isDutyNagTime", () => {
  it("9시 30분 전에는 안 띄운다", () => {
    expect(isDutyNagTime(21 * 60 + 29)).toBe(false);
    expect(isDutyNagTime(19 * 60)).toBe(false);
  });

  it("9시 30분부터 띄운다", () => {
    expect(isDutyNagTime(21 * 60 + 30)).toBe(true);
  });

  it("한참 지나서 열어도 계속 띄운다 — 늦게 열었다고 안내를 놓치면 안 된다", () => {
    expect(isDutyNagTime(23 * 60)).toBe(true);
  });
});

describe("shouldFillClinicFromKiosk", () => {
  it("클리닉 출결이 아직 비어 있으면 키오스크 기록으로 채운다", () => {
    expect(shouldFillClinicFromKiosk(false, false)).toBe(true);
  });

  it("자동 지각으로 찍혀 있으면 덮는다 — 키오스크 기록이 더 정확하다", () => {
    expect(shouldFillClinicFromKiosk(true, true)).toBe(true);
  });

  it("사람이 눌러둔 건 건드리지 않는다 — 사정을 알고 바꾼 것이다", () => {
    expect(shouldFillClinicFromKiosk(true, false)).toBe(false);
  });
});
