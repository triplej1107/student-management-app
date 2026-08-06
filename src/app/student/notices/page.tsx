import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/authz";
import { getStudentById, listNoticesForClass, listCalendarNotesForRange } from "@/lib/data";
import { getToday } from "@/lib/today";
import { addMonths, monthStart, monthEnd, parseYearMonth, toYearMonth } from "@/lib/weeks";
import { ScreenTitle, Tag, EmptyState } from "@/components/ui";
import { MonthCalendar } from "@/components/MonthCalendar";
import { TabSeenBeacon } from "@/components/TabSeenBeacon";

export default async function StudentNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireStudentSession();
  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const { today } = getToday();
  const { month: monthParam } = await searchParams;
  const monthDate = monthParam ? parseYearMonth(monthParam) : monthStart(today);
  const prevMonth = toYearMonth(addMonths(monthDate, -1));
  const nextMonth = toYearMonth(addMonths(monthDate, 1));

  const [notices, allMonthNotes] = await Promise.all([
    student.class_key
      ? listNoticesForClass(student.class_key, undefined, session.role === "parent" ? "parent" : "student")
      : [],
    listCalendarNotesForRange(monthStart(monthDate), monthEnd(monthDate)),
  ]);
  const calendarNotes = allMonthNotes.filter(
    (n) =>
      !n.class_keys ||
      n.class_keys.length === 0 ||
      (student.class_key !== null && n.class_keys.includes(student.class_key))
  );

  return (
    <div className="box-border px-5 pt-2 pb-6">
      <TabSeenBeacon tab="notices" />
      <ScreenTitle>공지사항</ScreenTitle>
      <div className="mt-4 flex flex-col gap-2.5">
        {notices.length === 0 && <EmptyState>등록된 공지가 없어요.</EmptyState>}
        {notices.map((n) => (
          <div key={n.id} className="rounded-2xl border border-line-soft bg-white p-3.5">
            <div className="flex items-center gap-2">
              {n.tag && <Tag>{n.tag}</Tag>}
              <span className="text-xs text-ink-muted">{n.notice_date}</span>
            </div>
            <div className="mt-2 text-sm font-bold text-ink">{n.title}</div>
            {n.content && (
              <div className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                {n.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <MonthCalendar
        monthDate={monthDate}
        notes={calendarNotes}
        prevHref={`/student/notices?month=${prevMonth}`}
        nextHref={`/student/notices?month=${nextMonth}`}
      />
    </div>
  );
}
