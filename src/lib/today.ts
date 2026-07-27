import { dayLabelOf, mondayOf } from "./weeks";

/** Single source of truth for "now" so every screen agrees on the current session. */
export function getToday() {
  const today = new Date();
  const weekStart = mondayOf(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  // 클리닉/수업 콘텐츠는 지난주 수업에 대한 것이 이번 주에 기록된다 —
  // 지금 진행 중인 클리닉의 주차(week_start)는 달력상 지난주 월요일.
  const clinicWeekStart = new Date(weekStart);
  clinicWeekStart.setDate(clinicWeekStart.getDate() - 7);
  return { today, weekStart, weekEnd, clinicWeekStart, dayLabel: dayLabelOf(today) };
}
