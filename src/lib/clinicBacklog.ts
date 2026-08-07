import "server-only";
import { supabase } from "./supabase";
import {
  listStudents,
  getClinicTemplatesForWeek,
  getClinicChecksForStudents,
  getStudentById,
  getClinicTemplate,
  getClinicCheck,
} from "./data";
import { isWeekSettled, isClinicFullyDone, filledHwSlots, filledTestSlots } from "./clinicProgress";
import { isWeekOnOrAfterEnrollment } from "./enrollmentWeek";
import { rollingClinicWeeks, toISODate, weekLabel } from "./weeks";
import type { ClassKey } from "./types";

/** "그 주가 정말 끝났는지" 판정 — 조교결재(staff_approved)만으로는 밀림에서
 * 빠지지 않고, 종주T 최종결재(zongju_approved)까지 나야 빠진다.
 *
 * 점검표 주차 알약의 초록/빨강도 같은 함수를 쓴다(clinicProgress.isWeekSettled)
 * — 두 곳이 갈라지면 "카드는 빨간데 주차는 초록"이 된다. */
const isBacklogResolved = isWeekSettled;

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
 *
 * 신규 학생은 first_lesson_date(첫수업일)가 있으면 그 주 이전 주차를 아예
 * 대상에서 뺀다 — 안 그러면 이번 주에 처음 온 학생이 몇 달치 밀림으로
 * 잡힌다. (student.created_at은 벌크 이관 시각이 찍혀있어 등록일로 쓸 수
 * 없어서 별도 컬럼을 뒀다.) 첫수업일이 비어있는 기존 학생은 예전과 똑같이
 * "그 주 반에 템플릿이 없으면 제외"라는 조건만 적용된다.
 *
 * rollingClinicWeeks가 돌려주는 가장 최근 주(예: 오늘이 8월 1주차 동안이면
 * "7월 4주차")는 지금 한창 채점 중인 주라 아직 "밀렸다"고 볼 수 없다
 * (weeks.ts의 rollingClinicWeeks 주석 참고) — 그래서 한 주 더 뒤로 밀어
 * 채점 기간이 완전히 끝난 주부터 평가한다.
 *
 * onlyStudentIds를 주면 그 학생들만 계산한다 — 출결 화면처럼 그날 로스터
 * 몇십 명만 필요한 곳에서 전교생 조회를 피하려는 용도. 판정 기준 자체는
 * 밀림 관리 탭과 완전히 동일하다.
 */
export async function getClinicBacklog(
  lookbackWeeks = 10,
  opts?: { onlyStudentIds?: number[] }
): Promise<ClinicBacklogEntry[]> {
  const allStudents = await listStudents({ enrolledOnly: true });
  const only = opts?.onlyStudentIds ? new Set(opts.onlyStudentIds) : null;
  const students = only ? allStudents.filter((s) => only.has(s.id)) : allStudents;
  if (students.length === 0) return [];
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
      if (!isWeekOnOrAfterEnrollment(week, student.first_lesson_date)) continue; // 입학 전 주차
      const template = templatesByWeek[i].get(classKey);
      if (!template) continue; // 그 주에 배정된 클리닉이 없으면 대상에서 제외
      if (clearedSet.has(`${student.id}_${toISODate(week)}`)) continue; // 종주T가 청산 처리함
      const check = checksByWeek[i].get(student.id);
      if (!isBacklogResolved(template, check)) {
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

/**
 * 출결 화면용 — 주어진 학생들의 "몇 주 밀렸는지"만 뽑아 map으로 돌려준다.
 * 밀림이 없는 학생은 아예 키가 없다. 판정은 getClinicBacklog와 동일하므로
 * 밀림 관리 탭 숫자와 항상 일치한다.
 *
 * 출결 체크는 매일 쓰는 핵심 기능이라, 밀림 조회가 실패해도 화면 자체는
 * 떠야 한다 — 실패하면 빈 map을 돌려주고 카드 색만 안 칠해진다.
 */
export async function getBacklogWeeksByStudent(
  studentIds: number[]
): Promise<Map<number, number>> {
  if (studentIds.length === 0) return new Map();
  try {
    const entries = await getClinicBacklog(10, { onlyStudentIds: studentIds });
    return new Map(entries.map((e) => [e.studentId, e.weeksOverdue]));
  } catch (err) {
    console.error("[attendance] 밀림 표시 조회 실패 — 색상 없이 렌더", err);
    return new Map();
  }
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

export interface StudentBacklogDetail {
  weeksOverdue: number;
  oldestIncompleteLabel: string;
  oldestIncompleteWeekISO: string;
  missingHwLabels: string[];
  missingTestLabels: string[];
}

/**
 * 학생 개인용 — 로그인 시 "지금 나한테 뭐가 밀려있는지" 보여주는 경고
 * 모달용. getClinicBacklog와 같은 "가장 오래된 미완료 주" 판정 로직을
 * 쓰지만, 그 학생 한 명만 조회하므로 훨씬 가볍다 (홈 화면처럼 자주
 * 여는 곳에서 호출 가능).
 */
export async function getStudentBacklogDetail(
  studentId: number,
  lookbackWeeks = 10
): Promise<StudentBacklogDetail | null> {
  const student = await getStudentById(studentId);
  if (!student?.class_key) return null;
  const classKey = student.class_key;

  const weeksDesc = rollingClinicWeeks(lookbackWeeks + 1);
  const weeksAsc = weeksDesc.slice(1).reverse();

  const [templatesByWeek, checksByWeek, clearedSet] = await Promise.all([
    Promise.all(weeksAsc.map((w) => getClinicTemplate(classKey, w))),
    Promise.all(weeksAsc.map((w) => getClinicCheck(studentId, w))),
    getClearedWeekSet([studentId]),
  ]);

  for (let i = 0; i < weeksAsc.length; i++) {
    const week = weeksAsc[i];
    if (!isWeekOnOrAfterEnrollment(week, student.first_lesson_date)) continue; // 입학 전 주차
    const template = templatesByWeek[i];
    if (!template) continue;
    if (clearedSet.has(`${studentId}_${toISODate(week)}`)) continue;
    const check = checksByWeek[i];
    if (!isClinicFullyDone(template, check ?? undefined)) {
      const missingHwLabels = filledHwSlots(template)
        .filter((idx) => !check?.hw_checks?.[idx])
        .map((idx) => template.hw_labels[idx]);
      const missingTestLabels = filledTestSlots(template)
        .filter((idx) => !check?.test_scores?.[idx]?.score)
        .map((idx) => template.test_labels[idx]);
      return {
        weeksOverdue: weeksAsc.length - i,
        oldestIncompleteLabel: weekLabel(week),
        oldestIncompleteWeekISO: toISODate(week),
        missingHwLabels,
        missingTestLabels,
      };
    }
  }
  return null;
}

/** The most recent clinic week whose grading period has fully closed —
 * i.e. the "as of" week this run of the backlog dashboard evaluated
 * against. Contact-log entries are keyed to this week so that a still-
 * unresolved 2주+ backlog gets a fresh, unchecked entry each week it
 * persists, while past weeks' call notes remain as history. */
export function currentBacklogEvalWeek(): Date {
  return rollingClinicWeeks(2)[1];
}
