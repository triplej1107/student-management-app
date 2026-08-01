import "server-only";
import { listStudents, getClinicChecksForStudents } from "./data";
import { rollingClinicWeeks, toISODate, weekLabel } from "./weeks";
import type { Student } from "./types";

export interface PendingApprovalEntry {
  student: Student;
  weekStartISO: string;
  weekLabelText: string;
  /** 이번(가장 최근) 클리닉 주차 건인지 — 지난 주차 건을 눈에 띄게 구분하려고. */
  isCurrentWeek: boolean;
}

/**
 * 조교 확인은 끝났는데 종주T 최종결재만 안 된 건 전부 — 요일·주차를 가리지
 * 않는다.
 *
 * 결재 화면은 "선택한 요일 + 이번 주차"만 보여주기 때문에, 지난 주차에
 * 밀린 결재는 눌러보기 전엔 존재조차 알 수 없었다. 오래 밀린 것부터
 * 위로 오도록 과거 주차 순으로 정렬한다.
 */
export async function getPendingApprovals(lookbackWeeks = 8): Promise<PendingApprovalEntry[]> {
  const students = await listStudents({ enrolledOnly: true });
  if (students.length === 0) return [];
  const ids = students.map((s) => s.id);
  const byId = new Map(students.map((s) => [s.id, s]));

  const weeksDesc = rollingClinicWeeks(lookbackWeeks);
  const currentWeekISO = toISODate(weeksDesc[0]);
  const checksByWeek = await Promise.all(weeksDesc.map((w) => getClinicChecksForStudents(ids, w)));

  const entries: PendingApprovalEntry[] = [];
  for (let i = 0; i < weeksDesc.length; i++) {
    const weekStartISO = toISODate(weeksDesc[i]);
    for (const [studentId, check] of checksByWeek[i]) {
      if (!check.staff_approved || check.zongju_approved) continue;
      const student = byId.get(studentId);
      if (!student) continue;
      entries.push({
        student,
        weekStartISO,
        weekLabelText: weekLabel(weeksDesc[i]),
        isCurrentWeek: weekStartISO === currentWeekISO,
      });
    }
  }

  // 오래 밀린 주차부터. 같은 주차 안에서는 이름순.
  entries.sort(
    (a, b) =>
      a.weekStartISO.localeCompare(b.weekStartISO) || a.student.name.localeCompare(b.student.name, "ko")
  );
  return entries;
}
