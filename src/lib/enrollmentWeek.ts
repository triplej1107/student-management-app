import { mondayOf, parseISODate, toISODate } from "./weeks";

/** 첫수업일이 속한 주의 월요일 = 그 학생의 첫 클리닉 주차(week_start).
 *
 * 클리닉 주차는 "수업이 있었던 주"의 월요일로 표기된다(weeks.ts 참고) —
 * 8월 1주차에 첫 수업을 들으면 그 수업에 대한 클리닉이 8월 1주차 클리닉이다.
 * 그래서 첫수업일의 주 월요일이 곧 그 학생이 책임지는 첫 주차가 된다.
 *
 * 첫수업일이 없으면(기존 학생 대부분) null — 호출부는 "전 주차 대상"으로
 * 기존과 동일하게 처리해야 한다. */
export function firstClinicWeekStart(firstLessonDate: string | null): Date | null {
  if (!firstLessonDate) return null;
  const parsed = parseISODate(firstLessonDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return mondayOf(parsed);
}

/** 그 주차가 이 학생의 책임 범위에 드는지 — 첫수업 전 주차면 false.
 * 첫수업일이 비어있으면 기존 동작 그대로 전부 true. */
export function isWeekOnOrAfterEnrollment(weekStart: Date, firstLessonDate: string | null): boolean {
  const first = firstClinicWeekStart(firstLessonDate);
  if (!first) return true;
  return toISODate(weekStart) >= toISODate(first);
}
