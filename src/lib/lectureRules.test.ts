import { describe, it, expect } from "vitest";
import {
  LATE_AFTER_MINUTES,
  MISSING_AFTER_MINUTES,
  isSyncStale,
  shouldNotifyStale,
  lectureRosterForDay,
  minutesOfTime,
  missingMessage,
  missingStudents,
  needsMakeup,
  isDutyNagTime,
  shouldFillClinicFromKiosk,
  lectureSlotLabel,
  makeupSlotsFor,
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

describe("조정해둔 학생에게는 결석 알림이 안 간다 (원장님 시나리오)", () => {
  // 김연우가 토9시 반인데, 금요일에 "이번 주는 일요일 7시에 가겠다"고 연락이 와서
  // 앱에서 조정을 눌러뒀다. 맥가이7에는 토요일 결석으로 뜨더라도, 앱 명단에
  // 없으니 알림이 가면 안 된다.
  const students = [
    { id: 1, student_code: "77332", name: "김연우", class_day: "토", class_time: "09:00" },
    { id: 2, student_code: "17233", name: "김시후", class_day: "토", class_time: "09:00" },
  ];
  const moved = new Map([[1, { studentId: 1, movedDay: "일", movedTime: "19:00" }]]);
  const at = (hhmm: string) => minutesOfTime(hhmm)!;

  it("토요일 명단에서 빠진다", () => {
    const sat = lectureRosterForDay(students, "토", moved);
    expect(sat.map((e) => e.name)).toEqual(["김시후"]);
  });

  it("아무도 안 찍혀도 조정한 학생은 결석으로 안 잡힌다", () => {
    // 맥가이7 기준으로는 둘 다 결석이지만, 판정은 **앱 명단**으로만 한다.
    const sat = lectureRosterForDay(students, "토", moved);
    const missing = missingStudents(sat, new Set(), at("13:55"));
    expect(missing.map((e) => e.name)).toEqual(["김시후"]);
  });

  it("옮겨간 일요일 명단에는 들어간다 — 조교가 화면에서 확인할 수 있게", () => {
    const sun = lectureRosterForDay(students, "일", moved);
    expect(sun.map((e) => e.name)).toEqual(["김연우"]);
    expect(sun[0].moved).toBe(true);
  });

  it("옮긴 학생이 옮겨간 날에 찍었으면 결석으로 안 잡는다", () => {
    // 학급별 조회로는 김연우가 일요일에 찍은 기록이 안 잡히지만(일요일 반
    // 소속이 아니라서), 학급에 안 묶인 등하원 로그에는 그대로 남는다.
    const sun = lectureRosterForDay(students, "일", moved);
    expect(missingStudents(sun, new Set([1]), at("23:00"))).toEqual([]);
  });

  it("옮겨놓고 안 오면 옮겨간 날에 결석으로 잡는다", () => {
    // 한동안은 옮긴 학생을 판정에서 통째로 뺐었다. 등하원 로그가 없어서
    // 온 학생을 결석으로 만들 위험이 있었기 때문인데, 그 대가로 옮겨놓고
    // 안 온 학생을 아무도 모르게 됐다. 이제는 찍기만 하면 잡히니 뺄 이유가 없다.
    const sun = lectureRosterForDay(students, "일", moved);
    expect(missingStudents(sun, new Set(), at("23:00")).map((e) => e.name)).toEqual(["김연우"]);
  });

  it("아예 일요일 반인 학생은 토요일 명단에 처음부터 없다", () => {
    const sundayOnly = [{ id: 3, student_code: "51801", name: "김다솔", class_day: "일", class_time: "19:00" }];
    expect(lectureRosterForDay(sundayOnly, "토")).toEqual([]);
    expect(missingStudents(lectureRosterForDay(sundayOnly, "토"), new Set(), at("13:55"))).toEqual([]);
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

describe("lectureSlotLabel", () => {
  it("원장님이 부르는 대로 12시간제로", () => {
    expect(lectureSlotLabel("토", "09:00")).toBe("토요일 9시");
    expect(lectureSlotLabel("토", "16:00")).toBe("토요일 4시");
    expect(lectureSlotLabel("일", "19:00")).toBe("일요일 7시");
    expect(lectureSlotLabel("일", "13:00")).toBe("일요일 1시");
  });

  it("분이 있으면 붙인다", () => {
    expect(lectureSlotLabel("토", "09:30")).toBe("토요일 9시 30분");
  });

  it("정오·자정도 12시로", () => {
    expect(lectureSlotLabel("토", "12:00")).toBe("토요일 12시");
    expect(lectureSlotLabel("토", "00:00")).toBe("토요일 12시");
  });

  it("시각을 못 읽으면 원문 그대로 — 조용히 틀린 라벨을 보여주지 않는다", () => {
    expect(lectureSlotLabel("토", "아침")).toBe("토요일 아침");
  });
});

describe("makeupSlotsFor", () => {
  it("자기 반의 다른 타임만 준다 — 지금 있는 타임은 옮길 이유가 없다", () => {
    const slots = makeupSlotsFor("1학년정규", "토", "09:00");
    expect(slots.map((s) => `${s.day}${s.time}`)).toEqual(["토16:00", "일19:00"]);
  });

  it("타임이 하나뿐인 반은 옮길 곳이 없다", () => {
    expect(makeupSlotsFor("예비고1", "일", "16:00")).toEqual([]);
  });

  it("다른 타임에 있으면 그 반 타임이 전부 후보에 남는다", () => {
    expect(makeupSlotsFor("예비고1", "토", "09:00")).toHaveLength(1);
  });

  it("반이 없으면 빈 목록 — 화면은 직접 입력으로 넘어간다", () => {
    expect(makeupSlotsFor(null, "토", "09:00")).toEqual([]);
  });

  it("2학기 반도 자기 타임표를 그대로 쓴다", () => {
    expect(makeupSlotsFor("가락고1", "토", "09:00").map((s) => `${s.day}${s.time}`)).toEqual(["일10:00"]);
    expect(makeupSlotsFor("배명고1", "일", "19:00").map((s) => `${s.day}${s.time}`)).toEqual(["토16:00"]);
    expect(makeupSlotsFor("배명고2", "토", "19:00").map((s) => `${s.day}${s.time}`)).toEqual(["일13:00"]);
  });
});

describe("shouldNotifyStale", () => {
  const now = Date.parse("2026-08-08T10:00:00Z");
  const long = "2026-08-08T00:00:00Z"; // 10시간 전 — 죽은 상태
  const fresh = "2026-08-08T09:55:00Z"; // 5분 전 — 살아 있음

  it("살아 있으면 몇 분이든 안 보낸다", () => {
    for (const minute of [0, 3, 30, 59]) {
      expect(shouldNotifyStale(fresh, now, minute)).toBe(false);
    }
  });

  it("죽었어도 매시 첫 5분에만 보낸다 — 안 그러면 시간당 12번 울린다", () => {
    expect(shouldNotifyStale(long, now, 0)).toBe(true);
    expect(shouldNotifyStale(long, now, 4)).toBe(true);
    expect(shouldNotifyStale(long, now, 5)).toBe(false);
    expect(shouldNotifyStale(long, now, 30)).toBe(false);
    expect(shouldNotifyStale(long, now, 59)).toBe(false);
  });

  it("5분 간격으로 부르면 한 시간에 정확히 한 번만 걸린다", () => {
    for (let phase = 0; phase < 5; phase++) {
      const hits = [];
      for (let i = 0; i < 12; i++) {
        const minute = (phase + i * 5) % 60;
        if (shouldNotifyStale(long, now, minute)) hits.push(minute);
      }
      expect(hits).toHaveLength(1);
    }
  });

  it("한 번도 성공한 적이 없으면 죽은 것으로 본다", () => {
    expect(shouldNotifyStale(null, now, 0)).toBe(true);
    expect(shouldNotifyStale(null, now, 30)).toBe(false);
  });
});
