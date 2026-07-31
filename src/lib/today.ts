import { dayLabelOf, mondayOf, wednesdayOf, kstToday } from "./weeks";

/** Single source of truth for "now" so every screen agrees on the current session.
 *
 * 반드시 kstToday()를 써야 한다 — Vercel 서버는 UTC로 돌기 때문에 new Date()를
 * 그대로 쓰면 한국 시간 자정~오전 9시 사이에 서버가 "어제"라고 판단한다. 실제로
 * 이 때문에 토요일 새벽에 출결 화면 기본 탭이 금요일로 잡히고, 전날 자동 결석
 * 목록도 금요일 탭에 붙어버렸다. */
export function getToday() {
  const today = kstToday();
  const weekStart = mondayOf(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  // 클리닉/수업 콘텐츠는 지난주 수업에 대한 것이 이번 주에 기록된다 —
  // 지금 진행 중인 클리닉의 주차(week_start)는 달력상 지난주 월요일.
  const clinicWeekStart = new Date(weekStart);
  clinicWeekStart.setDate(clinicWeekStart.getDate() - 7);
  // 학부모 질문 칸이 리셋되는 기준 — 수요일 00시.
  const questionWeekStart = wednesdayOf(today);
  return { today, weekStart, weekEnd, clinicWeekStart, questionWeekStart, dayLabel: dayLabelOf(today) };
}
