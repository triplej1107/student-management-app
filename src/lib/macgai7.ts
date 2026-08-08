import "server-only";
import type { MacgaiCheckIn } from "./lectureAttendance";
import {
  buildArgString,
  checkOutTimesFromLog,
  classQueryParts,
  mergeCheckIns,
  parseJobResponse,
  reasonsByStudentCode,
  sanitizeMacgaiInput,
  toCheckIns,
  toCheckInsFromLog,
} from "./macgai7Parse";

/**
 * 맥가이7(edu.macgai7.com) 등하원명단 읽어오기.
 *
 * 맥가이7은 API가 없어서 화면이 쓰는 요청을 그대로 흉내낸다. 아래 흐름은
 * 전부 실제 응답을 보고 확인한 것이다(scripts/macgai7-probe.mjs로 조사).
 *
 *   ① POST /job/member_login_S01.aspx   → 회원정보 + TOKEN
 *   ② GET  /c_index.aspx?m_idx=&token=  → 세션 쿠키
 *   ③ GET  /teacher/schedule/attend.aspx → M_BRANCH, 강사 번호 읽기
 *   ④ POST /job/class_reset_S03.aspx    → 그날 학급 목록(C_IDX)
 *   ⑤ POST /job/attend_S01.aspx         → 학급별 등원 시각 + 결석사유
 *   ⑥ POST /job/attend_report_S07.aspx  → 등하원 로그(학급에 안 묶인 날것)
 *
 * ⑤와 ⑥을 **둘 다** 읽어 합친다. ⑤는 학급 명단에 묶여 있어 클리닉만 하러
 * 온 학생이나 요일을 옮겨 온 학생이 안 보이고, ⑥은 그날 문을 통과한 사람이
 * 전부 보이는 대신 결석사유가 없다. 서로의 구멍을 메운다.
 *
 * 필요한 건 **학번과 등원 시각 둘뿐**이다. 이름·학교·전화번호도 같이 오지만
 * 가져가지 않는다 — 앱에 저장할 이유가 없고, 지나가기만 해도 사고 위험만
 * 는다(macgai7Parse.toCheckIns 참고).
 *
 * 맥가이7이 화면을 개편하면 여기가 **조용히** 멈춘다. 그래서 실패는 전부
 * 던지고, 크론이 macgai_sync_log에 남겨 3시간 넘게 성공이 없으면 알린다.
 */

const BASE = process.env.MACGAI7_BASE ?? "https://edu.macgai7.com";
const ATTEND_PAGE = "/teacher/schedule/attend.aspx";

/** 연동이 준비됐는지 — 크론이 헛돌지 않게 미리 확인한다. */
export function isMacgaiConfigured(): boolean {
  return !!process.env.MACGAI7_ID && !!process.env.MACGAI7_PASSWORD;
}

/** 쿠키를 들고 다니는 아주 작은 세션. 맥가이7은 쿠키를 20개 가까이 준다. */
class Session {
  private jar = new Map<string, string>();

  private store(res: Response) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const i = pair.indexOf("=");
      if (i > 0) this.jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }

  private header() {
    return [...this.jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async get(path: string): Promise<Response> {
    const res = await fetch(`${BASE}${path}`, {
      headers: { cookie: this.header(), "user-agent": UA },
      redirect: "manual",
    });
    this.store(res);
    return res;
  }

  /** /job/*.aspx는 "a=1,b=2" 문자열을 통째로 본문에 담아 받는다. */
  async job(path: string, fields: Record<string, string>) {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        cookie: this.header(),
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": UA,
      },
      body: buildArgString(fields),
      redirect: "manual",
    });
    this.store(res);
    const parsed = parseJobResponse(await res.text());
    if (!parsed.ok) {
      throw new Error(`맥가이7 ${path} 실패: ${parsed.description || `HTTP ${res.status}`}`);
    }
    return parsed;
  }
}

const UA = "Mozilla/5.0 (compatible; yujong-attendance/1.0)";

/** ①② 로그인 — TOKEN을 받아 c_index로 세션을 연다. */
async function login(session: Session): Promise<void> {
  const id = process.env.MACGAI7_ID ?? "";
  const pw = process.env.MACGAI7_PASSWORD ?? "";

  const res = await fetch(`${BASE}/job/member_login_S01.aspx`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
    body: new URLSearchParams({
      IN_M_ID: sanitizeMacgaiInput(id),
      IN_M_PASSWORD: sanitizeMacgaiInput(pw),
      IN_M_BRANCH: "",
    }).toString(),
  });
  const text = await res.text();

  let rows: Array<Record<string, string>>;
  try {
    rows = JSON.parse(text);
  } catch {
    throw new Error("맥가이7 로그인 응답을 읽지 못했습니다. 화면이 바뀌었을 수 있어요.");
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("맥가이7 로그인 실패 — 아이디 또는 비밀번호를 확인해주세요.");
  }
  const me = rows[0];
  if (me.LOGIN_LEVEL === "N") throw new Error("맥가이7 계정에 로그인 권한이 없습니다.");
  if (!me.M_IDX || !me.TOKEN) throw new Error("맥가이7 로그인 응답에 TOKEN이 없습니다.");

  const opened = await session.get(
    `/c_index.aspx?m_idx=${encodeURIComponent(me.M_IDX)}&token=${encodeURIComponent(me.TOKEN)}`
  );
  if (opened.status >= 400) {
    throw new Error(`맥가이7 세션 열기 실패 (HTTP ${opened.status})`);
  }
}

/** ③ 조회에 필요한 두 값 — 지점 번호와 강사 번호는 화면에 박혀 있다. */
async function readPageContext(session: Session): Promise<{ branch: string; teacher: string }> {
  const html = await (await session.get(ATTEND_PAGE)).text();
  const branch = html.match(/\bM_BRANCH\s*=\s*["']([^"']*)["']/)?.[1] ?? "";
  const teacher =
    html
      .match(/<select\b[^>]*name\s*=\s*["']sel_staff["'][\s\S]*?<\/select>/i)?.[0]
      ?.match(/value\s*=\s*["'](\d+)["']/)?.[1] ?? "";
  if (!branch) throw new Error("맥가이7 화면에서 지점 번호(M_BRANCH)를 찾지 못했습니다.");
  return { branch, teacher };
}

/** 하루치 조회 결과 — 등원 기록과, 조교가 맥가이7에 적어둔 결석/지각 사유. */
export interface MacgaiDay {
  checkIns: MacgaiCheckIn[];
  /** 학번 → 사유. 적혀 있는 학생만 담긴다. */
  reasons: Record<string, string>;
  /** 학번 → 하원 시각. 등하원 로그에서만 온다. */
  checkOutTimes: Record<string, string>;
  /** 등하원 로그에서 읽은 줄 수 — 0이면 로그 쪽이 안 걸린 것이다. */
  logCount: number;
  /** 등하원 로그 조회가 실패했으면 그 이유. 강의 출결은 그래도 진행한다. */
  logError?: string;
}

/**
 * ⑥ 등하원 로그 — 출결현황 화면의 "무수업생" 표에서 숫자를 누르면 열리는 명단.
 *
 * 인자 모양은 화면 스크립트(tb_no_study_click)를 그대로 옮긴 것이다. 두 가지가
 * 함정이라 적어둔다:
 *
 *   - `in_aopt`는 **칸 이름을 그대로** 넘긴다(`T_CNT`/`M_CNT`/`MI_CNT`/`N_CNT`).
 *     `T`/`M` 같은 축약으로 넣으면 오류 없이 **0줄**이 와서 원인을 찾기 어렵다.
 *   - 기간이 아니라 **하루**다. 시작일과 종료일에 같은 날짜를 넣는다.
 *
 * `T_CNT`(전체)로 한 번에 받고, 그게 비면 나머지 세 구분을 따로 받아 잇는다 —
 * 지점 설정에 따라 전체 칸이 안 잡히는 경우를 대비한 것이다.
 */
async function fetchDayLog(
  session: Session,
  branch: string,
  date: string
): Promise<Record<string, string>[]> {
  const query = (aopt: string) =>
    session.job("/job/attend_report_S07.aspx", {
      in_branch: branch,
      in_s_date: date,
      in_e_date: date,
      in_aopt: aopt,
      in_bigcategory: "",
      in_category: "",
      in_grade: "",
      in_school: "",
    });

  const all = await query("T_CNT");
  if (all.rows.length > 0) return all.rows;

  const rows: Record<string, string>[] = [];
  for (const aopt of ["M_CNT", "MI_CNT", "N_CNT"]) {
    rows.push(...(await query(aopt)).rows);
  }
  return rows;
}

/** 등원 명단만 필요할 때 — 시험과 옛 호출부가 쓴다. */
export async function fetchTodayCheckIns(dateISO?: string): Promise<MacgaiCheckIn[]> {
  return (await fetchTodayAttendance(dateISO)).checkIns;
}

/**
 * 오늘 강의 출결 한 벌 — 등원 기록 + 결석/지각 사유.
 *
 * dateISO를 주면 그 날짜로 조회한다(시험용). 비우면 오늘(KST).
 */
export async function fetchTodayAttendance(dateISO?: string): Promise<MacgaiDay> {
  if (!isMacgaiConfigured()) {
    throw new Error("MACGAI7_ID / MACGAI7_PASSWORD 가 설정되지 않았습니다.");
  }
  const date = dateISO ?? todayKstISO();

  const session = new Session();
  await login(session);
  const { branch, teacher } = await readPageContext(session);

  // ⑥ 등하원 로그가 먼저다 — 강의가 없는 날에도(클리닉만 하는 평일) 읽어야 한다.
  //    여기가 막혀도 강의 출결까지 같이 죽으면 안 되므로 실패를 삼키고 남긴다.
  let logRows: Record<string, string>[] = [];
  let logError: string | undefined;
  try {
    logRows = await fetchDayLog(session, branch, date);
  } catch (e) {
    logError = e instanceof Error ? e.message : String(e);
  }
  const logCheckIns = toCheckInsFromLog(logRows);
  const checkOutTimes = checkOutTimesFromLog(logRows);

  // ④ 그날 수업이 있는 학급들. 이게 비면 출결 조회가 빈 목록을 준다.
  const classes = await session.job("/job/class_reset_S03.aspx", {
    in_c_branch: branch,
    in_c_yyyymmdd: date,
    in_c_grade: "",
    in_c_category: "",
    in_c_bigcategory: "",
    in_c_teacher: teacher,
  });
  const { classIds, temps } = classQueryParts(classes.rows);
  // 그날 강의가 없는 날 — 정상이다. 로그는 이미 읽었으니 그것만 돌려준다.
  if (!classIds) {
    return { checkIns: logCheckIns, reasons: {}, checkOutTimes, logCount: logRows.length, logError };
  }

  // ⑤ 학생별 등원 시각 + 결석사유.
  const attend = await session.job("/job/attend_S01.aspx", {
    in_m_branch: branch,
    in_yyyymmdd: date,
    in_bigcategory: "",
    in_category: "",
    in_class: classIds,
    in_inout: "",
    in_m_grade: "",
    in_teacher: teacher,
    in_search: "",
    in_temp: temps,
    in_su_time: "",
  });

  return {
    checkIns: mergeCheckIns(logCheckIns, toCheckIns(attend.rows)),
    reasons: reasonsByStudentCode(attend.rows),
    checkOutTimes,
    logCount: logRows.length,
    logError,
  };
}

/** 오늘 날짜 "YYYY-MM-DD" (KST). nowKST는 UTC 게터로 읽어야 한국 시각이 된다. */
function todayKstISO(): string {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}-${String(k.getUTCDate()).padStart(2, "0")}`;
}
