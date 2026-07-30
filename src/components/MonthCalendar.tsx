import Link from "next/link";
import type { CalendarNote } from "@/lib/types";
import { DAY_ORDER } from "@/lib/types";
import { parseISODate, toISODate } from "@/lib/weeks";

function dateLabel(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function MonthCalendar({
  monthDate,
  notes,
  prevHref,
  nextHref,
}: {
  monthDate: Date;
  notes: CalendarNote[];
  prevHref?: string;
  nextHref?: string;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 월요일=0 ... 일요일=6 offset for the 1st of the month.
  const jsDay = firstDay.getDay();
  const leadingBlanks = jsDay === 0 ? 6 : jsDay - 1;

  const notesByDate = new Map<string, CalendarNote[]>();
  for (const n of notes) {
    const start = parseISODate(n.note_date);
    const end = parseISODate(n.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = toISODate(d);
      const list = notesByDate.get(iso) ?? [];
      list.push(n);
      notesByDate.set(iso, list);
    }
  }

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  return (
    <div className="mt-6">
      <div className="mb-2.5 flex items-center justify-between">
        {prevHref ? (
          <Link
            href={prevHref}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-sm text-ink-secondary"
            aria-label="이전 달"
          >
            ‹
          </Link>
        ) : (
          <span className="w-7" />
        )}
        <div className="text-sm font-bold text-ink">
          {year}년 {month + 1}월
        </div>
        {nextHref ? (
          <Link
            href={nextHref}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white text-sm text-ink-secondary"
            aria-label="다음 달"
          >
            ›
          </Link>
        ) : (
          <span className="w-7" />
        )}
      </div>
      <div className="rounded-2xl border border-line-soft bg-white p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-ink-muted">
          {DAY_ORDER.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dateObj = new Date(year, month, day);
            const iso = toISODate(dateObj);
            const dayNotes = notesByDate.get(iso) ?? [];
            const isToday = isCurrentMonth && today.getDate() === day;
            return (
              <div
                key={i}
                className={
                  "flex h-10 flex-col items-center justify-start rounded-lg pt-1 text-[12px] " +
                  (isToday ? "bg-accent-soft font-bold text-accent" : "text-ink")
                }
              >
                <span>{day}</span>
                {dayNotes.length > 0 && <span className="mt-0.5 h-1 w-1 rounded-full bg-accent" />}
              </div>
            );
          })}
        </div>
      </div>

      {notes.length > 0 && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start gap-2 rounded-xl border border-line-soft bg-white px-3 py-2">
              <span className="flex-none text-xs font-bold text-accent">
                {n.note_date === n.end_date
                  ? dateLabel(n.note_date)
                  : `${dateLabel(n.note_date)}~${dateLabel(n.end_date)}`}
              </span>
              <span className="text-xs text-ink-secondary whitespace-pre-wrap">{n.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
