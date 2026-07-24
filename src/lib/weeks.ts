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

/** "7월 4주차" — month of the week's Monday + ceil(day-of-month / 7). */
export function weekLabel(weekStart: Date): string {
  const month = weekStart.getMonth() + 1;
  const round = Math.ceil(weekStart.getDate() / 7);
  return `${month}월 ${round}주차`;
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

/** 월요일=0 ... 일요일=6 index for a JS Date. */
export function dayLabelOf(date: Date): (typeof DAY_ORDER)[number] {
  const jsDay = date.getDay(); // 0=Sun
  const idx = jsDay === 0 ? 6 : jsDay - 1;
  return DAY_ORDER[idx];
}
