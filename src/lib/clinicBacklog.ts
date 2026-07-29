import "server-only";
import { supabase } from "./supabase";
import { listStudents, getClinicTemplatesForWeek, getClinicChecksForStudents } from "./data";
import { isClinicFullyDone } from "./clinicProgress";
import { rollingClinicWeeks, toISODate, weekLabel } from "./weeks";
import type { ClassKey } from "./types";

export interface ClinicBacklogEntry {
  studentId: number;
  studentName: string;
  classKey: ClassKey;
  weeksOverdue: number;
  oldestIncompleteLabel: string;
  oldestIncompleteWeekISO: string;
}

/**
 * 밀림 관리 — 학생별로 아직 완료 못 한 "가장 오래된" 클리닉 주를 찾아
 * 몇 주째 밀렸는지를 계산한다. 그보다 최근 주를 이미 다 끝냈어도 오래된
 * 미완료 항목이 남아있으면 계속 밀림으로 집계된다 (밀린 항목 자체가
 * 해소돼야, 즉 그 주 체크박스가 뒤늦게라도 채워져야 빠진다).
 * (student.created_at은 벌크 이관 시각이 찍혀있어 실제 등록일 판단에
 * 쓸 수 없다 — 그래서 "그 주 반에 템플릿이 없으면 대상에서 제외"라는
 * 조건만으로 신규 학생 오탐지를 최대한 줄인다.)
 *
 * rollingClinicWeeks가 돌려주는 가장 최근 주(예: 오늘이 8월 1주차 동안이면
 * "7월 4주차")는 지금 한창 채점 중인 주라 아직 "밀렸다"고 볼 수 없다
 * (weeks.ts의 rollingClinicWeeks 주석 참고) — 그래서 한 주 더 뒤로 밀어
 * 채점 기간이 완전히 끝난 주부터 평가한다.
 */
export async function getClinicBacklog(lookbackWeeks = 10): Promise<ClinicBacklogEntry[]> {
  const students = await listStudents({ enrolledOnly: true });
  const weeksDesc = rollingClinicWeeks(lookbackWeeks + 1); // 최근 → 과거, 채점 중인 최신 주 포함
  const weeksAsc = weeksDesc.slice(1).reverse(); // 채점 중인 최신 주는 빼고, 과거 → 최근
  const studentIds = students.map((s) => s.id);

  const [templatesByWeek, checksByWeek, clearedSet] = await Promise.all([
    Promise.all(weeksAsc.map((w) => getClinicTemplatesForWeek(w))),
    Promise.all(weeksAsc.map((w) => getClinicChecksForStudents(studentIds, w))),
    getClearedWeekSet(studentIds),
  ]);

  const entries: ClinicBacklogEntry[] = [];
  for (const student of students) {
    if (!student.class_key) continue;
    const classKey = student.class_key;

    let oldestIncompleteIdx: number | null = null;
    for (let i = 0; i < weeksAsc.length; i++) {
      const week = weeksAsc[i];
      const template = templatesByWeek[i].get(classKey);
      if (!template) continue; // 그 주에 배정된 클리닉이 없으면 대상에서 제외
      if (clearedSet.has(`${student.id}_${toISODate(week)}`)) continue; // 종주T가 청산 처리함
      const check = checksByWeek[i].get(student.id);
      if (!isClinicFullyDone(template, check)) {
        oldestIncompleteIdx = i;
        break;
      }
    }

    if (oldestIncompleteIdx !== null) {
      const oldestWeek = weeksAsc[oldestIncompleteIdx];
      entries.push({
        studentId: student.id,
        studentName: student.name,
        classKey,
        weeksOverdue: weeksAsc.length - oldestIncompleteIdx,
        oldestIncompleteLabel: weekLabel(oldestWeek),
        oldestIncompleteWeekISO: toISODate(oldestWeek),
      });
    }
  }

  entries.sort((a, b) => b.weeksOverdue - a.weeksOverdue);
  return entries;
}

async function getClearedWeekSet(studentIds: number[]): Promise<Set<string>> {
  if (studentIds.length === 0) return new Set();
  const { data } = await supabase
    .from("clinic_backlog_clears")
    .select("student_id, week_start")
    .in("student_id", studentIds);
  return new Set((data ?? []).map((r) => `${r.student_id}_${r.week_start}`));
}

/** 종주T가 특정 학생의 특정 주차 밀림을 "청산" 처리 — 실제 숙제/테스트
 * 완료 여부(clinic_checks)는 그대로 두고, getClinicBacklog가 그 주를
 * 건너뛰게만 만든다. */
export async function clearClinicBacklogEntry(
  studentId: number,
  weekStart: Date,
  staffId?: number
) {
  await supabase.from("clinic_backlog_clears").upsert(
    {
      student_id: studentId,
      week_start: toISODate(weekStart),
      cleared_by: staffId ?? null,
      cleared_at: new Date().toISOString(),
    },
    { onConflict: "student_id,week_start" }
  );
}

/** The most recent clinic week whose grading period has fully closed —
 * i.e. the "as of" week this run of the backlog dashboard evaluated
 * against. Contact-log entries are keyed to this week so that a still-
 * unresolved 2주+ backlog gets a fresh, unchecked entry each week it
 * persists, while past weeks' call notes remain as history. */
export function currentBacklogEvalWeek(): Date {
  return rollingClinicWeeks(2)[1];
}
