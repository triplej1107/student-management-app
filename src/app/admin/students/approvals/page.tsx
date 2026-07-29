import Link from "next/link";
import { requireZongjuSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import {
  activeClinicDaysFrom,
  getClinicChecksForStudents,
  getClinicTemplatesForWeek,
  getWeeklyRoster,
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
  const { weekStart, weekEnd, clinicWeekStart, dayLabel: todayLabel } = getToday();
  const { day: dayParam } = await searchParams;

  const weeklyRoster = await getWeeklyRoster(weekStart, weekEnd);
  const activeDays = activeClinicDaysFrom(weeklyRoster);
  const selectedDay =
    dayParam && activeDays.includes(dayParam)
      ? dayParam
      : activeDays.includes(todayLabel)
        ? todayLabel
        : activeDays[0];

  const roster = selectedDay ? weeklyRoster.filter((r) => r.effDay === selectedDay) : [];

  const [checksMap, templatesMap] = await Promise.all([
    getClinicChecksForStudents(
      roster.map((r) => r.student.id),
      clinicWeekStart
    ),
    getClinicTemplatesForWeek(clinicWeekStart),
  ]);

  // 조교 확인까지 끝나 종주T 최종 결재만 남은 학생을 최상단으로.
  const rosterWithStatus = roster.map((r) => ({
    ...r,
    status: approvalStatus(
      r.student.class_key ? templatesMap.get(r.student.class_key) : undefined,
      checksMap.get(r.student.id)
    ),
  }));
  rosterWithStatus.sort((a, b) => {
    const rank = (s: string) => (s === "staff-approved" ? 0 : 1);
    const r = rank(a.status) - rank(b.status);
    return r !== 0 ? r : a.effTime.localeCompare(b.effTime);
  });

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
          {rosterWithStatus.map(({ student, effTime, status }) => {
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
