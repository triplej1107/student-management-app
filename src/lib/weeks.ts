import { DAY_ORDER } from "./types";

/** Formats a Date as a 'YYYY-MM-DD' string using local time (not UTC). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Returns the Monday of the week containing `date` (local time). */
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * "7월 4주차" — the week belongs to whichever month's 1st day falls inside it
 * (so the week spanning e.g. 6/29~7/5 counts as "7월 1주차", not "6월 5주차"),
 * and is numbered by how many Mondays it is from that month's first week.
 */
export function weekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const y = weekStart.getFullYear();
  const m = weekStart.getMonth();
  const firstOfNextMonth = new Date(y, m + 1, 1);
  const owningMonthFirst =
    firstOfNextMonth >= weekStart && firstOfNextMonth <= weekEnd
      ? firstOfNextMonth
      : new Date(y, m, 1);

  const monday1 = mondayOf(owningMonthFirst);
  const round = Math.round((weekStart.getTime() - monday1.getTime()) / (7 * 86400000)) + 1;
  return `${owningMonthFirst.getMonth() + 1}월 ${round}주차`;
}

/** Rolling window of week_start dates (Mondays), newest first. */
export function rollingWeeks(count: number, today: Date = new Date()): Date[] {
  const thisMonday = mondayOf(today);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() - 7 * i);
    return d;
  });
}

/** rollingWeeks anchored one week back. 수업/클리닉 콘텐츠는 주말 수업이
 * 끝난 다음 주에 기록되므로 (예: 7월 4주차 클리닉은 8월 1주차 동안 진행),
 * 진행 중인 달력상 이번 주는 아직 목록에 나타나면 안 된다 — 최신 주차는
 * 항상 "지난주"다. */
export function rollingClinicWeeks(count: number, today: Date = new Date()): Date[] {
  const anchor = new Date(today);
  anchor.setDate(anchor.getDate() - 7);
  return rollingWeeks(count, anchor);
}

/** 월요일=0 ... 일요일=6 index for a JS Date. */
export function dayLabelOf(date: Date): (typeof DAY_ORDER)[number] {
  const jsDay = date.getDay(); // 0=Sun
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return DAY_ORDER[idx];
}

/** Parses a 'YYYY-MM' string into the first day of that month (local time). */
export function parseYearMonth(ym: string): Date {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/** Formats a Date as a 'YYYY-MM' string. */
export function toYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

/** 수요일 00시를 기준으로 나뉘는 "질문 주"의 시작일(수요일) — 학부모 질문
 * 칸이 매주 수요일마다 자동으로 비워지도록 하는 데 쓰인다. */
export function wednesdayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jsDay = d.getDay(); // 0=Sun ... 3=Wed ... 6=Sat
  const diff = (jsDay - 3 + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

/** "요일+시" 표기(예: 토09) — 동명이인 학생을 구분하는 짧은 태그로 쓴다.
 * class_time이 "9:00"/"09:00"처럼 들쭉날쭉해도 항상 2자리로 맞춘다. */
export function classDayTimeTag(day: string | null, time: string | null): string | null {
  if (!day || !time) return null;
  const hour = time.split(":")[0].trim().padStart(2, "0");
  return `${day}${hour}`;
}
