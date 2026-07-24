import Link from "next/link";
import { requireZongjuSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import {
  getActiveClinicDays,
  getClinicChecksForStudents,
  getClinicTemplatesForWeek,
  getRosterForDay,
} from "@/lib/data";
import { approvalStatus, approvalLabel } from "@/lib/clinicProgress";
import { ScrollPillRow, PillLink, EmptyState, ScreenTitle } from "@/components/ui";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { STUDENT_SUB_TABS } from "../subTabs";

const BADGE_STYLE: Record<string, string> = {
  "no-template": "bg-line-soft text-ink-muted",
  unchecked: "bg-line-soft text-ink-muted",
  "staff-approved": "bg-accent-soft text-accent",
  "zongju-approved": "bg-success-soft text-success",
};

export default async function AdminApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  await requireZongjuSession();
  const { weekStart, weekEnd, dayLabel: todayLabel } = getToday();
  const { day: dayParam } = await searchParams;

  const activeDays = await getActiveClinicDays(weekStart, weekEnd);
  const selectedDay =
    dayParam && activeDays.includes(dayParam)
      ? dayParam
      : activeDays.includes(todayLabel)
        ? todayLabel
        : activeDays[0];

  const roster = selectedDay ? await getRosterForDay(selectedDay, weekStart, weekEnd) : [];
  roster.sort((a, b) => a.effTime.localeCompare(b.effTime));

  const [checksMap, templatesMap] = await Promise.all([
    getClinicChecksForStudents(
      roster.map((r) => r.student.id),
      weekStart
    ),
    getClinicTemplatesForWeek(weekStart),
  ]);

  return (
    <div>
      <AdminSubNav tabs={STUDENT_SUB_TABS} />
      <div className="mt-4">
        <ScreenTitle>결재 관리</ScreenTitle>
        <ScrollPillRow>
          {activeDays.map((d) => (
            <PillLink key={d} href={`/admin/students/approvals?day=${d}`} active={d === selectedDay}>
              {d}요일
            </PillLink>
          ))}
        </ScrollPillRow>

        <div className="mt-3.5 flex flex-col gap-2.5">
          {roster.length === 0 && <EmptyState>이 요일에는 학생이 없어요.</EmptyState>}
          {roster.map(({ student, effTime }) => {
            const template = student.class_key ? templatesMap.get(student.class_key) : undefined;
            const status = approvalStatus(template, checksMap.get(student.id));
            return (
              <Link
                key={student.id}
                href={`/admin/students/approvals/${student.id}`}
                className="flex items-center justify-between rounded-2xl border border-line-soft bg-white p-3.5"
              >
                <div>
                  <div className="text-[15px] font-bold text-ink">{student.name}</div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {effTime} · {student.class_key ?? "미배정"}
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1.5 text-xs font-bold ${BADGE_STYLE[status]}`}>
                  {approvalLabel(status)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
