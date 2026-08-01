import Link from "next/link";
import { requireZongjuSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import {
  activeClinicDaysFrom,
  getClinicChecksForStudents,
  getClinicTemplatesForWeek,
  getWeeklyRoster,
} from "@/lib/data";
import {
  approvalStatus,
  approvalLabel,
  clinicProgressLabel,
  testProgressLabel,
  isClinicComplete,
  isTestComplete,
} from "@/lib/clinicProgress";
import { getPendingApprovals } from "@/lib/approvals";
import { ScrollPillRow, PillLink, EmptyState, ScreenTitle } from "@/components/ui";
import { AdminGroupedSubNav } from "@/components/admin/AdminTopNav";
import { STUDENT_TAB_GROUPS } from "../subTabs";

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

  const [checksMap, templatesMap, pendingApprovals] = await Promise.all([
    getClinicChecksForStudents(
      roster.map((r) => r.student.id),
      clinicWeekStart
    ),
    getClinicTemplatesForWeek(clinicWeekStart),
    getPendingApprovals(),
  ]);

  // 조교 확인까지 끝나 종주T 최종 결재만 남은 학생을 최상단으로.
  const rosterWithStatus = roster.map((r) => {
    const template = r.student.class_key ? templatesMap.get(r.student.class_key) : undefined;
    const check = checksMap.get(r.student.id);
    return {
      ...r,
      status: approvalStatus(template, check),
      hwLabel: template ? clinicProgressLabel(template, check) : null,
      hwComplete: template ? isClinicComplete(template, check) : false,
      testLabel: template ? testProgressLabel(template, check) : null,
      testComplete: template ? isTestComplete(template, check) : false,
    };
  });
  rosterWithStatus.sort((a, b) => {
    const rank = (s: string) => (s === "staff-approved" ? 0 : 1);
    const r = rank(a.status) - rank(b.status);
    return r !== 0 ? r : a.effTime.localeCompare(b.effTime);
  });

  return (
    <div>
      <AdminGroupedSubNav groups={STUDENT_TAB_GROUPS} />
      <div className="mt-4">
        <ScreenTitle>결재 관리</ScreenTitle>

        {pendingApprovals.length > 0 && (
          <div className="mb-4 rounded-2xl border border-accent/40 bg-accent-soft/40 p-3.5">
            <div className="text-[13px] font-extrabold text-accent">
              ⏳ 최종결재 대기 {pendingApprovals.length}명
            </div>
            <div className="mt-0.5 mb-2 text-[11px] text-ink-muted">
              요일·주차 상관없이 조교 확인까지 끝난 건 전부예요. 오래 밀린 주차가 위에 있어요.
            </div>
            <div className="flex flex-col gap-1.5">
              {pendingApprovals.map((p) => (
                <Link
                  key={`${p.student.id}_${p.weekStartISO}`}
                  href={`/admin/students/approvals/${p.student.id}?week=${p.weekStartISO}`}
                  className="flex items-center justify-between rounded-xl bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-ink">
                      {p.student.name}
                      <span className="ml-1 text-[11px] font-normal text-ink-muted">
                        {p.student.student_code}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-muted">
                      {p.student.class_key ?? "미배정"}
                    </div>
                  </div>
                  <span
                    className={
                      "flex-none rounded-full px-2 py-1 text-[11px] font-bold " +
                      (p.isCurrentWeek ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn")
                    }
                  >
                    {p.weekLabelText}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <ScrollPillRow>
          {activeDays.map((d) => (
            <PillLink key={d} href={`/admin/students/approvals?day=${d}`} active={d === selectedDay}>
              {d}요일
            </PillLink>
          ))}
        </ScrollPillRow>

        <div className="mt-3.5 flex flex-col gap-2.5">
          {roster.length === 0 && <EmptyState>이 요일에는 학생이 없어요.</EmptyState>}
          {rosterWithStatus.map(({ student, effTime, status, hwLabel, hwComplete, testLabel, testComplete }) => {
            return (
              <Link
                key={student.id}
                href={`/admin/students/approvals/${student.id}`}
                className="flex items-center justify-between rounded-2xl border border-line-soft bg-white p-3.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
              >
                <div>
                  <div className="text-[15px] font-bold text-ink">
                    {student.name}
                    <span className="ml-1 text-xs font-normal text-ink-muted">{student.student_code}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {effTime} · {student.class_key ?? "미배정"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {hwLabel && hwLabel !== "원본 없음" && (
                    <span
                      className={
                        "rounded-full px-2 py-1 text-[11px] font-bold " +
                        (hwComplete ? "bg-success-soft text-success" : "bg-accent-soft text-accent")
                      }
                    >
                      {hwLabel}
                    </span>
                  )}
                  {testLabel && (
                    <span
                      className={
                        "rounded-full px-2 py-1 text-[11px] font-bold " +
                        (testComplete ? "bg-success-soft text-success" : "bg-accent-soft text-accent")
                      }
                    >
                      {testLabel}
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${BADGE_STYLE[status]}`}>
                    {approvalLabel(status)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
