import { dayLabelOf, mondayOf } from "./weeks";

/** Single source of truth for "now" so every screen agrees on the current session. */
export function getToday() {
  const today = new Date();
  const weekStart = mondayOf(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return { today, weekStart, weekEnd, dayLabel: dayLabelOf(today) };
}
