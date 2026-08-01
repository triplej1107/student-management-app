import { describe, it, expect } from "vitest";
import {
  parseClassSchedule,
  parseGradeLabel,
  normalizeStudentCode,
  normalizeExportDate,
  normalizeDayLabel,
  normalizeTimeLabel,
} from "./academyExport";

describe("parseClassSchedule", () => {
  it("종주T 국어 수업의 요일·시간을 뽑는다", () => {
    expect(parseClassSchedule("종주(고1정규)-토9시[고등국어]")).toEqual({ day: "토", time: "09:00" });
    expect(parseClassSchedule("종주(고2 정규)-토19시[고등국어]")).toEqual({ day: "토", time: "19:00" });
    expect(parseClassSchedule("종주(예비고1)-일16시[고등국어]")).toEqual({ day: "일", time: "16:00" });
  });

  it("다른 선생님 과목이 섞여 있어도 국어만 골라낸다", () => {
    expect(
      parseClassSchedule("찬희(고1정규)-일13시[고등사탐]／종주(고1정규)-일19시[고등국어]")
    ).toEqual({ day: "일", time: "19:00" });
    expect(
      parseClassSchedule(
        "종주(고2 정규)-토19시[고등국어]／가연(Sound Check)-목18시[고등영어]／가연(기본독해)-목16시[고등영어]"
      )
    ).toEqual({ day: "토", time: "19:00" });
  });

  it("국어 수업이 없거나 비어 있으면 null", () => {
    expect(parseClassSchedule("찬희(정치)-토12시[고등사탐]")).toBeNull();
    expect(parseClassSchedule("")).toBeNull();
    expect(parseClassSchedule("형식이상")).toBeNull();
  });
});

describe("parseGradeLabel", () => {
  it("고1/고2/중3을 구분·학년으로 나눈다", () => {
    expect(parseGradeLabel("고1")).toEqual({ level: "고등", grade: "1" });
    expect(parseGradeLabel("고2")).toEqual({ level: "고등", grade: "2" });
    expect(parseGradeLabel("중3")).toEqual({ level: "중등", grade: "3" });
  });

  it("모르는 형식이면 둘 다 null이라 기존 값을 덮지 않는다", () => {
    expect(parseGradeLabel("")).toEqual({ level: null, grade: null });
    expect(parseGradeLabel("재수")).toEqual({ level: null, grade: null });
  });
});

describe("normalizeStudentCode", () => {
  it("앞자리 0이 떨어진 학번을 5자리로 되살린다", () => {
    expect(normalizeStudentCode("1021")).toBe("01021");
    expect(normalizeStudentCode("01021")).toBe("01021");
    expect(normalizeStudentCode("66001")).toBe("66001");
  });

  it("숫자가 없으면 빈 문자열", () => {
    expect(normalizeStudentCode("")).toBe("");
    expect(normalizeStudentCode("-")).toBe("");
  });
});

// 2학기부터 프로그램에 채워질 코칭수업(클리닉) 요일·시간 대비.
// 표기가 흔들리면 자동 지각 판정과 출결 명단이 통째로 어긋나므로
// 흔한 표기를 전부 앱 형식으로 흡수하는지 고정해둔다.
describe("normalizeDayLabel", () => {
  it("여러 표기에서 요일 한 글자만 뽑는다", () => {
    expect(normalizeDayLabel("토")).toBe("토");
    expect(normalizeDayLabel("토요일")).toBe("토");
    expect(normalizeDayLabel("(일)")).toBe("일");
    expect(normalizeDayLabel(" 수 ")).toBe("수");
  });

  it("요일이 없으면 null — 기존 클리닉 요일을 지우지 않게", () => {
    expect(normalizeDayLabel("")).toBeNull();
    expect(normalizeDayLabel("미정")).toBeNull();
  });
});

describe("normalizeTimeLabel", () => {
  it("여러 표기를 HH:MM으로 통일한다", () => {
    expect(normalizeTimeLabel("15:00")).toBe("15:00");
    expect(normalizeTimeLabel("15시")).toBe("15:00");
    expect(normalizeTimeLabel("9")).toBe("09:00");
    expect(normalizeTimeLabel("9:5")).toBe("09:05");
    expect(normalizeTimeLabel("15시 30분")).toBe("15:30");
  });

  it("오전/오후 표기를 24시간제로 바꾼다", () => {
    expect(normalizeTimeLabel("오후 3시")).toBe("15:00");
    expect(normalizeTimeLabel("오전 9시")).toBe("09:00");
    expect(normalizeTimeLabel("오후 12시")).toBe("12:00");
    expect(normalizeTimeLabel("오전 12시")).toBe("00:00");
  });

  it("읽을 수 없으면 null — 기존 클리닉 시간을 지우지 않게", () => {
    expect(normalizeTimeLabel("")).toBeNull();
    expect(normalizeTimeLabel("미정")).toBeNull();
    expect(normalizeTimeLabel("99시")).toBeNull();
  });
});

describe("normalizeExportDate", () => {
  it("여러 구분자를 YYYY-MM-DD로 통일한다", () => {
    expect(normalizeExportDate("2026-07-31")).toBe("2026-07-31");
    expect(normalizeExportDate("2026.7.5")).toBe("2026-07-05");
    expect(normalizeExportDate("2026/12/25")).toBe("2026-12-25");
  });

  it("시간이 붙어 있어도 날짜만 뽑는다", () => {
    expect(normalizeExportDate("2026-07-31 00:00:00")).toBe("2026-07-31");
  });

  it("빈 칸이나 이상한 값은 null — 기존 값을 지우지 않게", () => {
    expect(normalizeExportDate("")).toBeNull();
    expect(normalizeExportDate("미정")).toBeNull();
  });
});
