import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/authz";
import {
  getStudentById,
  getClinicTemplate,
  getClinicCheck,
  listNoticesForClass,
  listCalendarNotesForRange,
} from "@/lib/data";
import { getToday } from "@/lib/today";
import { weekLabel, monthStart, monthEnd } from "@/lib/weeks";
import { EmptyState } from "@/components/ui";
import { ClinicChecklistReadOnly } from "@/components/ClinicChecklistReadOnly";
import { MonthCalendar } from "@/components/MonthCalendar";
import { logoutAction } from "@/app/login/actions";

export default async function StudentHomePage() {
  const session = await requireStudentSession();
  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const { weekStart, today } = getToday();
  const [template, check, notices, allMonthNotes] = await Promise.all([
    student.class_key ? getClinicTemplate(student.class_key, weekStart) : null,
    getClinicCheck(student.id, weekStart),
    student.class_key ? listNoticesForClass(student.class_key, 3) : [],
    listCalendarNotesForRange(monthStart(today), monthEnd(today)),
  ]);
  const calendarNotes = allMonthNotes.filter(
    (n) =>
      !n.class_keys ||
      n.class_keys.length === 0 ||
      (student.class_key !== null && n.class_keys.includes(student.class_key))
  );

  return (
    <div className="box-border px-5 pt-2 pb-6">
      <div className="flex items-center justify-between">
        <div className="text-xl font-extrabold text-ink">안녕하세요, {student.name}님</div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-sm text-ink-secondary"
            aria-label="로그아웃"
          >
            ↩
          </button>
        </form>
      </div>

      <div className="mt-5">
        <div className="mb-1 text-sm font-bold text-ink">이번주 클리닉 점검표</div>
        <div className="mb-2.5 text-xs text-ink-muted">{weekLabel(weekStart)}</div>
        {!template && <EmptyState>이번 주는 아직 등록된 점검표가 없어요.</EmptyState>}
        {template && <ClinicChecklistReadOnly template={template} check={check ?? undefined} />}
      </div>

      <div className="mt-5">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="text-sm font-bold text-ink">공지사항</div>
          <Link href="/student/notices" className="text-xs font-bold text-accent">
            전체보기 →
          </Link>
        </div>
        {notices.length === 0 && <div className="text-[13px] text-ink-muted/70">등록된 공지가 없어요.</div>}
        {notices.map((n) => (
          <div key={n.id} className="mb-2 rounded-xl border border-line-soft bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-ink">{n.title}</div>
              <div className="text-xs text-ink-muted">{n.notice_date}</div>
            </div>
            {n.content && <div className="mt-1 text-xs leading-relaxed text-ink-secondary">{n.content}</div>}
          </div>
        ))}
      </div>

      <MonthCalendar monthDate={today} notes={calendarNotes} />
    </div>
  );
}
