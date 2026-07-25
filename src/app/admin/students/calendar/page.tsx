import Link from "next/link";
import { requireZongjuSession } from "@/lib/authz";
import { listCalendarNotesForRange } from "@/lib/data";
import {
  addMonths,
  monthEnd,
  monthStart,
  parseYearMonth,
  toISODate,
  toYearMonth,
} from "@/lib/weeks";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { CalendarNoteEditorRow } from "@/components/admin/CalendarNoteEditorRow";
import { STUDENT_SUB_TABS } from "../subTabs";
import { addCalendarNoteAction } from "./actions";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireZongjuSession();
  const { month: monthParam } = await searchParams;
  const monthDate = monthParam ? parseYearMonth(monthParam) : monthStart(new Date());

  const start = monthStart(monthDate);
  const end = monthEnd(monthDate);
  const notes = await listCalendarNotesForRange(start, end);

  const prevMonth = toYearMonth(addMonths(monthDate, -1));
  const nextMonth = toYearMonth(addMonths(monthDate, 1));

  return (
    <div>
      <AdminSubNav tabs={STUDENT_SUB_TABS} />

      <div className="mt-4 flex items-center justify-between">
        <Link
          href={`/admin/students/calendar?month=${prevMonth}`}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-secondary"
        >
          ‹ 이전달
        </Link>
        <div className="text-sm font-extrabold text-ink">
          {monthDate.getFullYear()}년 {monthDate.getMonth() + 1}월
        </div>
        <Link
          href={`/admin/students/calendar?month=${nextMonth}`}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink-secondary"
        >
          다음달 ›
        </Link>
      </div>

      <div className="mt-3.5 flex flex-col gap-2.5">
        {notes.map((n) => (
          <CalendarNoteEditorRow key={n.id} note={n} />
        ))}
        <form action={addCalendarNoteAction.bind(null, toISODate(new Date()))}>
          <button
            type="submit"
            className="w-full rounded-[10px] border border-dashed border-ink-secondary/60 py-3 text-[13px] font-bold text-ink-secondary"
          >
            + 메모 추가
          </button>
        </form>
      </div>
    </div>
  );
}
