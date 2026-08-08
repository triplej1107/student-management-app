/**
 * 맥가이7 응답 해석 — 순수 계산만. 네트워크는 macgai7.ts에 있다.
 *
 * 여기 있는 규칙은 전부 **실제 응답을 눈으로 보고** 정한 것이다
 * (docs/맥가이7-연동-작업지시.md의 조사 기록 참고). 짐작으로 쓴 곳은 없다.
 */

import type { MacgaiCheckIn } from "./lectureAttendance";

/**
 * 맥가이7은 아이디·비밀번호에서 이 문자들을 **지우고** 보낸다
 * (로그인 화면의 sanitizeInput 그대로).
 *
 * 흉내내지 않으면 비밀번호에 `-`나 `'`가 든 순간 로그인이 조용히 실패하고,
 * 원인을 찾기 매우 어렵다.
 */
export function sanitizeMacgaiInput(input: string): string {
  return input.replace(/[-'"/\\;]/g, "");
}

/** `{ a: "1", b: "2" }` → `"a=1,b=2"`. 맥가이7이 실제로 받는 모양. */
export function buildArgString(fields: Record<string, string>): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
}

export interface JobResponse {
  ok: boolean;
  description: string;
  cols: string[];
  rows: Record<string, string>[];
}

/**
 * /job/*.aspx 응답 읽기.
 *
 * 모양: `[ {STATUS,DESCRIPTION}, {COL:"A:STRING(-1),B:DECIMAL(-1),…"}, …줄들 ]`
 * 줄은 화면에 따라 배열로도 객체로도 오므로 둘 다 받는다.
 */
export function parseJobResponse(text: string): JobResponse {
  let arr: unknown;
  try {
    arr = JSON.parse(text);
  } catch {
    return { ok: false, description: "응답을 JSON으로 읽지 못했습니다.", cols: [], rows: [] };
  }
  if (!Array.isArray(arr)) {
    return { ok: false, description: "응답이 배열이 아닙니다.", cols: [], rows: [] };
  }

  const isObj = (e: unknown): e is Record<string, unknown> =>
    !!e && typeof e === "object" && !Array.isArray(e);

  const status = arr.find((e) => isObj(e) && "STATUS" in e) as Record<string, unknown> | undefined;
  const colDef = arr.find((e) => isObj(e) && "COL" in e) as Record<string, unknown> | undefined;
  const cols = colDef
    ? String(colDef.COL)
        .split(",")
        .map((c) => c.split(":")[0].trim())
        .filter(Boolean)
    : [];

  const rows: Record<string, string>[] = [];
  const asRow = (r: unknown) => {
    if (Array.isArray(r)) {
      // 배열로 오면 COL 순서대로 짝짓는다.
      return Object.fromEntries(cols.map((c, i) => [c, r[i] == null ? "" : String(r[i])]));
    }
    if (isObj(r)) {
      return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? "" : String(v)]));
    }
    return null;
  };

  for (const e of arr) {
    if (e === status || e === colDef) continue;
    if (Array.isArray(e)) {
      for (const r of e) {
        const row = asRow(r);
        if (row) rows.push(row);
      }
    } else {
      const row = asRow(e);
      if (row) rows.push(row);
    }
  }

  return {
    ok: status?.STATUS === "OK",
    description: String(status?.DESCRIPTION ?? ""),
    cols,
    rows,
  };
}

/**
 * 학번 뽑기 — 출결 명단의 `M_GRADE_NAME` 칸에 학년과 학번이 **한 칸에**
 * 들어온다: `"고1<br>/51801"`. 화면에서 "고1 / 51801" 로 두 줄로 보이는 게 이것이다.
 *
 * `M_IDX`는 학번이 아니라 맥가이7 내부 회원번호(6자리)다 — 헷갈리기 쉬워
 * 따로 적어둔다.
 */
export function studentCodeFrom(gradeName: string | undefined | null): string | null {
  if (!gradeName) return null;
  const m = String(gradeName).match(/(\d{5})\s*$/);
  return m ? m[1] : null;
}

/** "09:02" 처럼 읽을 수 있는 시각만 통과시킨다. */
export function normalizeCheckInTime(raw: string | undefined | null): string | null {
  const m = String(raw ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

/**
 * 출결 명단 줄들 → 앱이 쓰는 등원 기록.
 *
 * **등원 시각이 있는 줄만** 남긴다. 결석한 학생은 IN_TIME이 빈 값으로 오는데,
 * 그걸 등원으로 넘기면 안 온 학생이 출석으로 찍힌다.
 *
 * 이름·학교·전화번호는 가져오지 않는다 — 앱에 저장할 이유가 없다.
 */
export function toCheckIns(rows: Record<string, string>[]): MacgaiCheckIn[] {
  const out: MacgaiCheckIn[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const studentCode = studentCodeFrom(row.M_GRADE_NAME);
    const checkedInTime = normalizeCheckInTime(row.IN_TIME);
    if (!studentCode || !checkedInTime) continue;
    // 한 학생이 여러 학급에 걸쳐 있으면 같은 학번이 두 번 올 수 있다.
    // 제일 이른 등원 시각을 남긴다 — 처음 들어온 때가 등원이다.
    const prev = out.find((c) => c.studentCode === studentCode);
    if (prev) {
      if (checkedInTime < prev.checkedInTime) prev.checkedInTime = checkedInTime;
      continue;
    }
    if (seen.has(studentCode)) continue;
    seen.add(studentCode);
    out.push({ studentCode, checkedInTime });
  }
  return out;
}

/**
 * 결석/지각사유 뽑기 — `SCHEINFO` 칸에 $로 이어져 온다.
 *
 *   등원한 줄 : "09:00 장종주$Y$5350283$"
 *   안 온 줄  : "09:00 장종주$$5350283$일요일"
 *                └ 수업·강사   └ 출석여부  └ 수업번호  └ **사유**
 *
 * 조교가 맥가이7에 적어둔 값이라(예: "일요일", "가족여행") 앱에도 남겨두면
 * "그때 뭐라고 했었지"를 되짚을 수 있다.
 */
export function absenceReasonFrom(scheInfo: string | undefined | null): string | null {
  if (!scheInfo) return null;
  const parts = String(scheInfo).split("$");
  if (parts.length < 4) return null;
  // 뒤쪽에 칸이 더 붙어도 사유는 네 번째다. 남는 건 사람이 적은 글이라
  // 그대로 살려둔다($가 섞여 있을 수 있어 다시 이어 붙인다).
  const reason = parts.slice(3).join("$").trim();
  return reason || null;
}

/** 맥가이7이 그 줄을 출석으로 보는지 — SCHEINFO 두 번째 칸이 "Y". */
export function macgaiMarkedPresent(scheInfo: string | undefined | null): boolean {
  return String(scheInfo ?? "").split("$")[1]?.trim() === "Y";
}

/** 학번 → 결석사유. 사유가 적힌 줄만 담는다. */
export function reasonsByStudentCode(rows: Record<string, string>[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const code = studentCodeFrom(row.M_GRADE_NAME);
    const reason = absenceReasonFrom(row.SCHEINFO);
    if (code && reason) out[code] = reason;
  }
  return out;
}

/** 학급 목록 줄들 → attend 조회에 넣을 C_IDX / T_TEMP 묶음. */
export function classQueryParts(rows: Record<string, string>[]): { classIds: string; temps: string } {
  const ids = rows.map((r) => r.C_IDX).filter(Boolean);
  const temps = rows.map((r) => r.T_TEMP ?? "").filter((t) => t !== "");
  return { classIds: ids.join("||"), temps: temps.join("||") };
}
