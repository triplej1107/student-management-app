import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

/**
 * 맥가이7 연동 전체 흐름 시험 — 로그인부터 등원 목록까지.
 *
 * 실제 맥가이7을 그대로 흉내낸 서버를 띄워서 확인한다. 조사로 알아낸 규칙
 * (TOKEN으로 세션 열기, argString 통째로 보내기, 학번이 M_GRADE_NAME 안에
 * 들어 있음, 결석은 IN_TIME이 빈 값)이 코드에 제대로 반영됐는지 보는 것이
 * 목적이다. 순수 계산은 macgai7Parse.test.ts에서 따로 본다.
 */

const ATTEND_COL =
  "ROWNO:STRING(-1),CHK:STRING(-1),C_NAME:STRING(-1),M_GRADE_NAME:STRING(-1),M_IDX:DECIMAL(-1)," +
  "M_SCHOOL:STRING(-1),M_NAME:STRING(-1),M_PHONE:STRING(-1),M_PARENT_PHONE:STRING(-1)," +
  "IN_TIME:STRING(-1),OUT_TIME:STRING(-1),S_DATE:STRING(-1)";

/** 실제 응답과 같은 모양: 결석은 IN_TIME이 빈 값. */
const ATTEND_ROWS = [
  ["", "A", "종주(고1정규)-토9시[고등국어]", "고1<br>/51801", "366801", "배명고", "김다솔", "010-0000-0000", "010-0000-0000", "", "", "2026-08-08"],
  ["", "A", "종주(고1정규)-토9시[고등국어]", "고1<br>/17233", "366802", "가락고", "김시후", "010-0000-0000", "010-0000-0000", "09:02", "", "2026-08-08"],
  ["", "A", "종주(고1정규)-토9시[고등국어]", "고1<br>/11923", "366803", "가락고", "김우태", "010-0000-0000", "010-0000-0000", "08:55", "", "2026-08-08"],
];

interface Seen {
  loginBody?: string;
  classBody?: string;
  attendBody?: string;
  attendCookie?: string;
}

let server: http.Server;
let baseUrl: string;
const seen: Seen = {};

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });
}

beforeAll(async () => {
  server = http.createServer(async (req, res) => {
    const url = (req.url ?? "").split("?")[0];
    const json = (o: unknown) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(o));
    };

    if (url === "/job/member_login_S01.aspx") {
      seen.loginBody = await readBody(req);
      const p = new URLSearchParams(seen.loginBody);
      // 맥가이7은 sanitizeInput을 거친 값을 받는다.
      if (p.get("IN_M_ID") === "tester" && p.get("IN_M_PASSWORD") === "pw1004") {
        return json([{ M_IDX: "366794", M_ID: "tester", LOGIN_LEVEL: "Y", M_BRANCH: "375", TOKEN: "tok-abc" }]);
      }
      return json([]);
    }

    if (url === "/c_index.aspx") {
      // 세션은 여기서 잡힌다.
      const ok = (req.url ?? "").includes("m_idx=366794") && (req.url ?? "").includes("token=tok-abc");
      res.writeHead(ok ? 200 : 403, {
        "content-type": "text/html",
        ...(ok ? { "set-cookie": "ASP.NET_SessionId=sess-1; Path=/" } : {}),
      });
      return res.end("<html>메인</html>");
    }

    if (url === "/teacher/schedule/attend.aspx") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(
        `<html><script>var M_BRANCH = "375";</script>
         <select name="sel_staff"><option value="366794">종주조교</option></select></html>`
      );
    }

    if (url === "/job/class_reset_S03.aspx") {
      seen.classBody = await readBody(req);
      const required = ["in_c_branch", "in_c_yyyymmdd", "in_c_grade", "in_c_category", "in_c_bigcategory", "in_c_teacher"];
      // 칸이 하나라도 없으면 실제 서버는 Fatal error를 뱉는다.
      if (!required.every((k) => seen.classBody!.includes(`${k}=`))) {
        return json([{ STATUS: "ERROR", DESCRIPTION: "Fatal error encountered during command execution." }]);
      }
      return json([
        { STATUS: "OK", DESCRIPTION: "" },
        { COL: "C_IDX:DECIMAL(-1),C_NAME:STRING(-1),CHK:STRING(-1),C_STU_CNT:DECIMAL(-1),T_TEMP:STRING(-1)" },
        [
          ["70710", "종주(고1정규)-토16시[고등국어]", "F", "16", "0"],
          ["70711", "종주(고1정규)-토9시[고등국어]", "F", "22", "0"],
        ],
      ]);
    }

    if (url === "/job/attend_S01.aspx") {
      seen.attendBody = await readBody(req);
      seen.attendCookie = req.headers.cookie ?? "";
      // 학급을 안 넘기면 줄이 안 온다 — 실제 동작 그대로.
      if (!/in_class=70710\|\|70711/.test(seen.attendBody)) {
        return json([{ STATUS: "OK", DESCRIPTION: "" }, { COL: ATTEND_COL }]);
      }
      return json([{ STATUS: "OK", DESCRIPTION: "" }, { COL: ATTEND_COL }, ATTEND_ROWS]);
    }

    res.writeHead(404);
    res.end("nope");
  });

  await new Promise<void>((r) => server.listen(0, r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.MACGAI7_BASE = baseUrl;
  process.env.MACGAI7_ID = "tester";
  process.env.MACGAI7_PASSWORD = "pw1004";
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("fetchTodayCheckIns", () => {
  it("로그인부터 등원 목록까지 이어진다", async () => {
    const { fetchTodayCheckIns } = await import("./macgai7");
    const out = await fetchTodayCheckIns("2026-08-08");

    // 결석한 김다솔(IN_TIME 빈 값)은 빠지고 등원한 둘만.
    expect(out).toEqual([
      { studentCode: "17233", checkedInTime: "09:02" },
      { studentCode: "11923", checkedInTime: "08:55" },
    ]);
  });

  it("세션 쿠키를 들고 조회한다 — 안 그러면 로그인 화면이 돌아온다", () => {
    expect(seen.attendCookie).toContain("ASP.NET_SessionId=sess-1");
  });

  it("학급 조회에 조건 여섯 개를 다 넣는다", () => {
    for (const k of ["in_c_branch=375", "in_c_yyyymmdd=2026-08-08", "in_c_grade=", "in_c_category=", "in_c_bigcategory=", "in_c_teacher=366794"]) {
      expect(seen.classBody).toContain(k);
    }
  });

  it("학급 번호를 || 로 이어 출결을 조회한다", () => {
    expect(seen.attendBody).toContain("in_class=70710||70711");
    expect(seen.attendBody).toContain("in_yyyymmdd=2026-08-08");
  });

  it("이름·전화번호는 결과에 담지 않는다", async () => {
    const { fetchTodayCheckIns } = await import("./macgai7");
    const out = await fetchTodayCheckIns("2026-08-08");
    expect(JSON.stringify(out)).not.toContain("김시후");
    expect(JSON.stringify(out)).not.toContain("010-");
  });

  it("비밀번호는 맥가이7 규칙대로 걸러 보낸다", async () => {
    process.env.MACGAI7_PASSWORD = "pw-1004";
    const { fetchTodayCheckIns } = await import("./macgai7");
    await fetchTodayCheckIns("2026-08-08");
    // 하이픈이 지워진 뒤 보내져서 로그인이 통과해야 한다.
    expect(new URLSearchParams(seen.loginBody).get("IN_M_PASSWORD")).toBe("pw1004");
    process.env.MACGAI7_PASSWORD = "pw1004";
  });

  it("아이디·비밀번호가 틀리면 분명히 실패한다", async () => {
    process.env.MACGAI7_PASSWORD = "wrong";
    const { fetchTodayCheckIns } = await import("./macgai7");
    await expect(fetchTodayCheckIns("2026-08-08")).rejects.toThrow(/아이디 또는 비밀번호/);
    process.env.MACGAI7_PASSWORD = "pw1004";
  });
});
