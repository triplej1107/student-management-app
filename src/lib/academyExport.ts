/** 기존 학원관리 프로그램의 "회원명단" 엑셀을 앱 학생 정보로 옮기기 위한
 * 순수 변환 함수들. 파일 읽기(exceljs)는 서버 액션에서 하고, 값 해석 규칙만
 * 여기 모아 테스트한다. */

/** 학급 문자열 한 칸에서 종주T 국어 수업만 골라 요일/시간을 뽑는다.
 * 예: "종주(고1정규)-토9시[고등국어]／찬희(고1정규)-목19시[고등사탐]"
 *      → { day: "토", time: "09:00" }
 * 다른 선생님 과목(사탐·영어)은 무시한다. 국어 수업이 없으면 null. */
export function parseClassSchedule(raw: string): { day: string; time: string } | null {
  if (!raw) return null;
  // 프로그램이 여러 수업을 전각 슬래시(／)로 잇는다. 반각도 함께 허용.
  const segments = raw.split(/[／/]/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const m = seg.match(/^(.+?)\((.+?)\)-(.)(\d{1,2})시\[(.+?)\]$/);
    if (!m) continue;
    const [, , , day, hour, subject] = m;
    if (!subject.includes("국어")) continue;
    return { day, time: `${hour.padStart(2, "0")}:00` };
  }
  return null;
}

/** "고1"/"중3" → { level: "고등"|"중등", grade: "1" }. 해석 불가면 둘 다 null. */
export function parseGradeLabel(raw: string): { level: string | null; grade: string | null } {
  if (!raw) return { level: null, grade: null };
  const m = raw.trim().match(/^(고|중)\s*(\d)$/);
  if (!m) return { level: null, grade: null };
  return { level: m[1] === "고" ? "고등" : "중등", grade: m[2] };
}

/** 학번은 5자리 숫자 — 프로그램이 앞자리 0을 떼고 내보내는 경우가 있어 채운다. */
export function normalizeStudentCode(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
    return digits ? digits.padStart(5, "0") : "";
}

/** 엑셀 셀이 날짜형/문자열 어느 쪽으로 와도 "YYYY-MM-DD"로. 못 읽으면 null
 * (= 빈 칸과 동일 취급이라 기존 값을 지우지 않는다). */
export function normalizeExportDate(raw: string): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
