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

/** 'YYYY-MM-DD'의 다음 날 — 월말/연말도 Date가 알아서 넘겨준다. */
export function nextDayISO(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + 1);
  return toISODate(d);
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
export function rollingWeeks(count: number, today: Date = kstToday()): Date[] {
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
export function rollingClinicWeeks(count: number, today: Date = kstToday()): Date[] {
  const anchor = new Date(today);
  anchor.setDate(anchor.getDate() - 7);
  return rollingWeeks(count, anchor);
}

/** 수업 내용 작성용 주차 목록 — rollingClinicWeeks 맨 앞에 "이번 주"를 하나
 * 더 붙인다.
 *
 * rollingClinicWeeks는 클리닉이 진행 중인 주차(= 지난주 수업)까지만 준다.
 * 그런데 종주T는 토요일 수업을 마치고 그 주 수업 내용을 바로 정리하고
 * 싶어하므로, 아직 클리닉이 시작되지 않은 이번 주 수업까지 고를 수 있어야
 * 한다. 학생 공개는 weeklyContentVisibility가 따로 막는다. */
export function rollingLessonWeeks(count: number, today: Date = kstToday()): Date[] {
  return [mondayOf(today), ...rollingClinicWeeks(count - 1, today)];
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

/** Rolling window of question-week start dates (Wednesdays), newest first —
 * 학부모 질문 내역 화면에서 지난 주차를 넘겨보는 데 쓴다. */
export function rollingQuestionWeeks(count: number, today: Date = kstToday()): Date[] {
  const thisWednesday = wednesdayOf(today);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(thisWednesday);
    d.setDate(d.getDate() - 7 * i);
    return d;
  });
}

/** "7/29~8/4" — 질문 주는 요일 그리드가 월요일 기준이 아니라서 weekLabel의
 * "N주차" 표기 대신 날짜 범위로 보여준다. */
export function questionWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(weekStart)}~${fmt(end)}`;
}

/** 서버 실행 타임존과 무관하게 KST(UTC+9) 벽시계 값을 안전하게 읽기 위한
 * Date — .getUTCHours()/.getUTCMinutes()/.getUTCDate() 등 UTC 게터로 읽어야
 * "한국 시각"이 된다(로컬 게터를 쓰면 서버 타임존이 섞여 틀어진다). */
export function nowKST(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

/** KST 기준 오늘 00:00(로컬 Date 객체, Y/M/D만 의미 있음) — 서버 타임존과
 * 무관하게 정확한 자정 크론(예: 22:00 KST 자동 결석 처리)에서 "오늘"을
 * 계산할 때 쓴다. */
export function kstToday(): Date {
  const k = nowKST();
  return new Date(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate());
}

/** 대체 일정이 실제로 잡힌 날짜 — makeup_schedules는 "원래 수업일"에 달려
 * 있고 목적지는 요일("수")로만 들어있어서, 그 주 안에서 요일을 날짜로 편다.
 * 예: 원래 8/7(금) 수업을 "수"로 옮겼으면 같은 주 수요일인 8/5.
 * 요일을 못 읽으면 null. */
export function makeupDateISO(sessionDateISO: string, makeupDay: string): string | null {
  const idx = DAY_ORDER.indexOf(makeupDay as (typeof DAY_ORDER)[number]);
  if (idx < 0) return null;
  const d = mondayOf(parseISODate(sessionDateISO));
  d.setDate(d.getDate() + idx);
  return toISODate(d);
}

/** timestamptz(예: "2026-08-01T06:12:33+00:00")를 KST 벽시계 "HH:MM"으로.
 * 서버 타임존이 뭐든 UTC+9로 옮긴 뒤 UTC 게터로 읽는다(nowKST와 같은 요령). */
export function kstTimeHHMM(timestamptz: string): string {
  const k = new Date(new Date(timestamptz).getTime() + 9 * 60 * 60 * 1000);
  return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
}

/** "HH:MM" 문자열을 자정 기준 분으로 변환. */
function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((s) => Number(s.trim()));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** 지금(KST)이 그 학생의 클리닉 시각을 이미 지났는지 — 미출석 학생의
 * "지각" 버튼을 자동으로 강조 표시하는 데 쓴다. */
export function isPastClinicTime(effTime: string): boolean {
  if (!effTime) return false;
  const k = nowKST();
  const nowMinutes = k.getUTCHours() * 60 + k.getUTCMinutes();
  return nowMinutes >= minutesOf(effTime);
}

/** "요일+시" 표기(예: 토09) — 동명이인 학생을 구분하는 짧은 태그로 쓴다.
 * class_time이 "9:00"/"09:00"처럼 들쭉날쭉해도 항상 2자리로 맞춘다. */
export function classDayTimeTag(day: string | null, time: string | null): string | null {
  if (!day || !time) return null;
  const hour = time.split(":")[0].trim().padStart(2, "0");
  return `${day}${hour}`;
}
