import { describe, it, expect } from "vitest";
import {
  absenceReasonFrom,
  buildArgString,
  checkOutTimesFromLog,
  classQueryParts,
  macgaiMarkedPresent,
  mergeCheckIns,
  normalizeCheckInTime,
  parseJobResponse,
  reasonsByStudentCode,
  sanitizeMacgaiInput,
  studentCodeFrom,
  toCheckIns,
  toCheckInsFromLog,
} from "./macgai7Parse";

describe("sanitizeMacgaiInput", () => {
  it("맥가이7이 지우는 문자를 똑같이 지운다", () => {
    // 로그인 화면의 sanitizeInput: /[-'"\/\\;]/g
    expect(sanitizeMacgaiInput(`ab-c'd"e/f\\g;h`)).toBe("abcdefgh");
  });

  it("보통 비밀번호는 그대로 둔다", () => {
    expect(sanitizeMacgaiInput("jjj1004!")).toBe("jjj1004!");
  });

  it("이걸 안 하면 하이픈 든 비밀번호가 조용히 실패한다", () => {
    expect(sanitizeMacgaiInput("my-pass")).toBe("mypass");
  });
});

describe("buildArgString", () => {
  it("a=1,b=2 모양으로 잇는다 — 맥가이7이 받는 형식", () => {
    expect(buildArgString({ in_a: "1", in_b: "" })).toBe("in_a=1,in_b=");
  });
});

describe("parseJobResponse", () => {
  const COL =
    "ROWNO:STRING(-1),C_NAME:STRING(-1),M_GRADE_NAME:STRING(-1),M_IDX:DECIMAL(-1),IN_TIME:STRING(-1)";

  it("STATUS·COL·줄들을 읽는다 (줄이 배열로 올 때)", () => {
    const text = JSON.stringify([
      { STATUS: "OK", DESCRIPTION: "" },
      { COL },
      [
        ["1", "종주(고1정규)-토9시", "고1<br>/51801", "366801", ""],
        ["2", "종주(고1정규)-토9시", "고1<br>/17233", "366802", "09:02"],
      ],
    ]);
    const p = parseJobResponse(text);
    expect(p.ok).toBe(true);
    expect(p.cols).toEqual(["ROWNO", "C_NAME", "M_GRADE_NAME", "M_IDX", "IN_TIME"]);
    expect(p.rows).toHaveLength(2);
    expect(p.rows[1].IN_TIME).toBe("09:02");
    expect(p.rows[1].M_GRADE_NAME).toBe("고1<br>/17233");
  });

  it("줄이 객체로 와도 읽는다", () => {
    const text = JSON.stringify([
      { STATUS: "OK", DESCRIPTION: "" },
      { COL: "C_IDX:DECIMAL(-1),T_TEMP:STRING(-1)" },
      { C_IDX: "70710", T_TEMP: "0" },
    ]);
    expect(parseJobResponse(text).rows).toEqual([{ C_IDX: "70710", T_TEMP: "0" }]);
  });

  it("줄이 없으면 빈 목록 — 조회 조건이 좁았을 뿐 오류가 아니다", () => {
    const p = parseJobResponse(JSON.stringify([{ STATUS: "OK", DESCRIPTION: "" }, { COL }]));
    expect(p.ok).toBe(true);
    expect(p.rows).toEqual([]);
  });

  it("서버 오류는 ok=false와 사유를 준다", () => {
    const p = parseJobResponse(
      '[{"STATUS":"ERROR","DESCRIPTION":"Fatal error encountered during command execution."}]'
    );
    expect(p.ok).toBe(false);
    expect(p.description).toContain("Fatal error");
  });

  it("JSON이 아니면 조용히 통과시키지 않는다 — 화면이 바뀐 신호다", () => {
    expect(parseJobResponse("<html>로그인 화면</html>").ok).toBe(false);
  });
});

describe("studentCodeFrom", () => {
  it("학년과 학번이 한 칸에 붙어 온다 — / 뒤 5자리가 학번", () => {
    expect(studentCodeFrom("고1<br>/51801")).toBe("51801");
    expect(studentCodeFrom("고2<br>/77332")).toBe("77332");
  });

  it("줄바꿈 태그가 없어도 읽는다", () => {
    expect(studentCodeFrom("고1 / 09181")).toBe("09181");
  });

  it("앞자리가 0이어도 5자리를 지킨다", () => {
    expect(studentCodeFrom("고1<br>/09181")).toBe("09181");
  });

  it("학번이 없으면 null — 모르는 채로 출석 처리하면 안 된다", () => {
    expect(studentCodeFrom("고1")).toBeNull();
    expect(studentCodeFrom("")).toBeNull();
    expect(studentCodeFrom(null)).toBeNull();
  });
});

describe("normalizeCheckInTime", () => {
  it("HH:MM 으로 맞춘다", () => {
    expect(normalizeCheckInTime("09:02")).toBe("09:02");
    expect(normalizeCheckInTime("9:02")).toBe("09:02");
    expect(normalizeCheckInTime(" 08:55 ")).toBe("08:55");
  });

  it("결석은 빈 값으로 온다 — null", () => {
    expect(normalizeCheckInTime("")).toBeNull();
    expect(normalizeCheckInTime(null)).toBeNull();
  });

  it("말이 안 되는 시각은 안 받는다", () => {
    expect(normalizeCheckInTime("25:00")).toBeNull();
    expect(normalizeCheckInTime("09:70")).toBeNull();
    expect(normalizeCheckInTime("오전")).toBeNull();
  });
});

describe("toCheckIns", () => {
  const row = (grade: string, inTime: string, extra: Record<string, string> = {}) => ({
    M_GRADE_NAME: grade,
    IN_TIME: inTime,
    M_NAME: "김민찬",
    M_PHONE: "010-1234-5678",
    ...extra,
  });

  it("등원한 학생만 남긴다", () => {
    const out = toCheckIns([
      row("고1<br>/51801", ""), // 결석
      row("고1<br>/17233", "09:02"),
      row("고1<br>/11923", "08:55"),
    ]);
    expect(out).toEqual([
      { studentCode: "17233", checkedInTime: "09:02" },
      { studentCode: "11923", checkedInTime: "08:55" },
    ]);
  });

  it("결석한 학생을 넘기지 않는다 — 안 온 학생이 출석으로 찍히면 안 된다", () => {
    expect(toCheckIns([row("고1<br>/51801", "")])).toEqual([]);
  });

  it("이름·전화번호는 가져오지 않는다", () => {
    const out = toCheckIns([row("고1<br>/17233", "09:02")]);
    expect(Object.keys(out[0])).toEqual(["studentCode", "checkedInTime"]);
  });

  it("같은 학생이 두 학급에 걸쳐 있으면 제일 이른 등원 시각을 쓴다", () => {
    const out = toCheckIns([row("고1<br>/17233", "09:02"), row("고1<br>/17233", "08:40")]);
    expect(out).toEqual([{ studentCode: "17233", checkedInTime: "08:40" }]);
  });

  it("학번을 못 읽는 줄은 건너뛴다", () => {
    expect(toCheckIns([row("고1", "09:02")])).toEqual([]);
  });
});

describe("absenceReasonFrom", () => {
  // 실제 응답에서 그대로 가져온 두 모양.
  const 등원한줄 = "09:00 장종주$Y$5350283$";
  const 안온줄 = "09:00 장종주$$5350283$일요일";

  it("안 온 줄의 사유를 읽는다", () => {
    expect(absenceReasonFrom(안온줄)).toBe("일요일");
  });

  it("등원한 줄은 사유가 없다", () => {
    expect(absenceReasonFrom(등원한줄)).toBeNull();
  });

  it("사유에 $가 섞여 있어도 통째로 살린다 — 사람이 적은 글이다", () => {
    expect(absenceReasonFrom("09:00 장종주$$5350283$가족여행 $ 다음주 복귀")).toBe("가족여행 $ 다음주 복귀");
  });

  it("모양이 다르면 null — 짐작해서 엉뚱한 조각을 넣지 않는다", () => {
    expect(absenceReasonFrom("09:00 장종주")).toBeNull();
    expect(absenceReasonFrom("")).toBeNull();
    expect(absenceReasonFrom(null)).toBeNull();
  });

  it("맥가이7이 출석으로 본 줄인지 알 수 있다", () => {
    expect(macgaiMarkedPresent(등원한줄)).toBe(true);
    expect(macgaiMarkedPresent(안온줄)).toBe(false);
  });
});

describe("reasonsByStudentCode", () => {
  it("사유가 적힌 학생만 담는다", () => {
    const rows = [
      { M_GRADE_NAME: "고1<br>/51801", SCHEINFO: "09:00 장종주$$5350283$일요일" },
      { M_GRADE_NAME: "고1<br>/17233", SCHEINFO: "09:00 장종주$Y$5350283$" },
      { M_GRADE_NAME: "고1<br>/46261", SCHEINFO: "09:00 장종주$$5350283$가족여행" },
    ];
    expect(reasonsByStudentCode(rows)).toEqual({ "51801": "일요일", "46261": "가족여행" });
  });

  it("학번을 못 읽으면 건너뛴다", () => {
    expect(reasonsByStudentCode([{ M_GRADE_NAME: "고1", SCHEINFO: "a$$b$일요일" }])).toEqual({});
  });
});

describe("toCheckInsFromLog (등하원명단)", () => {
  // 출결현황 > 등하원명단이 주는 모양 — 학번이 STU_NO라는 제 칸으로 온다.
  const row = (stuNo: string, inTime: string, outTime = "", status = "수업학생") => ({
    STU_NO: stuNo,
    IN_TIME: inTime,
    OUT_TIME: outTime,
    STATUS_NAME: status,
    M_NAME: "이민영",
    M_PHONE: "010-1111-2222",
  });

  it("찍고 온 학생만 남긴다", () => {
    expect(toCheckInsFromLog([row("50861", "10:02"), row("31391", "09:11", "12:01")])).toEqual([
      { studentCode: "50861", checkedInTime: "10:02" },
      { studentCode: "31391", checkedInTime: "09:11" },
    ]);
  });

  it("수업이 없는 날 온 학생도 잡는다 — 이게 클리닉 자동화의 핵심이다", () => {
    expect(toCheckInsFromLog([row("50861", "15:30", "", "무수업생")])).toEqual([
      { studentCode: "50861", checkedInTime: "15:30" },
    ]);
  });

  it("하루에 여러 번 드나들면 처음 들어온 때가 등원", () => {
    expect(toCheckInsFromLog([row("50861", "15:30"), row("50861", "09:02")])).toEqual([
      { studentCode: "50861", checkedInTime: "09:02" },
    ]);
  });

  it("등원 시각이 없으면 뺀다 — 하원만 찍힌 줄", () => {
    expect(toCheckInsFromLog([row("50861", "", "12:00")])).toEqual([]);
  });

  it("학번이 5자리가 아니면 뺀다 — 비원생·외부인", () => {
    expect(toCheckInsFromLog([row("", "10:02"), row("12", "10:02")])).toEqual([]);
  });

  it("이름·전화번호는 가져오지 않는다", () => {
    const out = toCheckInsFromLog([row("50861", "10:02")]);
    expect(Object.keys(out[0])).toEqual(["studentCode", "checkedInTime"]);
  });
});

describe("checkOutTimesFromLog", () => {
  const row = (stuNo: string, outTime: string) => ({ STU_NO: stuNo, IN_TIME: "09:00", OUT_TIME: outTime });

  it("하원 시각을 학번별로 준다", () => {
    expect(checkOutTimesFromLog([row("50861", "12:01")])).toEqual({ "50861": "12:01" });
  });

  it("여러 번 드나들었으면 마지막 하원이 그날 나간 시각", () => {
    expect(checkOutTimesFromLog([row("50861", "12:01"), row("50861", "18:40")])).toEqual({
      "50861": "18:40",
    });
  });

  it("하원을 안 찍은 학생은 없다 — 미귀가", () => {
    expect(checkOutTimesFromLog([row("50861", "")])).toEqual({});
  });
});

describe("classQueryParts", () => {
  it("C_IDX와 T_TEMP를 || 로 잇는다 — fn_query가 하는 그대로", () => {
    const parts = classQueryParts([
      { C_IDX: "70710", T_TEMP: "0" },
      { C_IDX: "70711", T_TEMP: "0" },
    ]);
    expect(parts.classIds).toBe("70710||70711");
    expect(parts.temps).toBe("0||0");
  });

  it("학급이 없으면 빈 문자열 — 그날 강의가 없는 날이다", () => {
    expect(classQueryParts([])).toEqual({ classIds: "", temps: "" });
  });
});

describe("mergeCheckIns", () => {
  it("같은 학생은 제일 이른 등원 시각으로 합친다", () => {
    const out = mergeCheckIns(
      [{ studentCode: "50861", checkedInTime: "09:02" }],
      [{ studentCode: "50861", checkedInTime: "08:40" }]
    );
    expect(out).toEqual([{ studentCode: "50861", checkedInTime: "08:40" }]);
  });

  it("한쪽에만 있는 학생도 남는다 — 클리닉만 온 학생이 이 경우다", () => {
    const out = mergeCheckIns(
      [{ studentCode: "50861", checkedInTime: "14:05" }],
      [{ studentCode: "17233", checkedInTime: "09:02" }]
    );
    expect(out.map((c) => c.studentCode).sort()).toEqual(["17233", "50861"]);
  });

  it("한쪽이 통째로 비어도 나머지는 그대로", () => {
    const only = [{ studentCode: "17233", checkedInTime: "09:02" }];
    expect(mergeCheckIns([], only)).toEqual(only);
    expect(mergeCheckIns(only, [])).toEqual(only);
  });

  it("넘겨받은 배열을 고치지 않는다", () => {
    const first = [{ studentCode: "50861", checkedInTime: "09:02" }];
    mergeCheckIns(first, [{ studentCode: "50861", checkedInTime: "08:40" }]);
    expect(first[0].checkedInTime).toBe("09:02");
  });
});
