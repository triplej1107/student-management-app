import Link from "next/link";
import { requireStaffSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import {
  activeClinicDaysFrom,
  getClinicChecksForStudents,
  getClinicTemplatesForWeek,
  getWeeklyRoster,
} from "@/lib/data";
import {
  approvalLabel,
  approvalStatus,
  clinicProgressLabel,
  isClinicComplete,
  isTestComplete,
  testProgressLabel,
} from "@/lib/clinicProgress";
import { ScreenTitle, ScrollPillRow, PillLink } from "@/components/ui";
import { SearchableRoster } from "@/components/SearchableRoster";
import { classDayTimeTag } from "@/lib/weeks";

const APPROVAL_BADGE_STYLE: Record<string, string> = {
  "no-template": "bg-line-soft text-ink-muted",
  unchecked: "bg-line-soft text-ink-muted",
  "staff-approved": "bg-accent-soft text-accent",
  "zongju-approved": "bg-success-soft text-success",
};

export default async function StaffClinicListPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  await requireStaffSession();
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
  roster.sort((a, b) => a.effTime.localeCompare(b.effTime));

  const [checksMap, templatesMap] = await Promise.all([
    getClinicChecksForStudents(
      roster.map((r) => r.student.id),
      clinicWeekStart
    ),
    getClinicTemplatesForWeek(clinicWeekStart),
  ]);

  const items = roster.map(({ student, effTime }) => {
    const template = student.class_key ? templatesMap.get(student.class_key) : undefined;
    const check = checksMap.get(student.id);
    const hwLabel = clinicProgressLabel(template, check);
    const hwComplete = template ? isClinicComplete(template, check) : false;
    const testLabel = testProgressLabel(template, check);
    const testComplete = template ? isTestComplete(template, check) : false;
    const status = approvalStatus(template, check);
    const schoolGrade = [student.school, student.grade ? `${student.grade}학년` : null]
      .filter(Boolean)
      .join(" ");
    const classTag = classDayTimeTag(student.class_day, student.class_time);

    return {
      key: student.id,
      searchText: `${student.name} ${student.school ?? ""} ${student.grade ?? ""}`,
      node: (
        <Link
          href={`/staff/clinic/${student.id}`}
          className="flex items-center justify-between rounded-2xl border border-line-soft bg-white p-3.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
        >
          <div>
            <div className="text-[15px] font-bold text-ink">
              {student.name}
              {classTag && <span className="text-xs font-normal text-ink-muted">({classTag})</span>}
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">
              {effTime}
              {schoolGrade && ` · ${schoolGrade}`}
            </div>
          </div>
          {!template ? (
            <span className="rounded-full bg-line-soft px-2.5 py-1.5 text-xs font-bold text-ink-muted">
              원본 없음
            </span>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <span
                className={
                  "rounded-full px-2 py-1 text-[11px] font-bold " +
                  (hwComplete ? "bg-success-soft text-success" : "bg-accent-soft text-accent")
                }
              >
                {hwLabel}
              </span>
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
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-bold ${APPROVAL_BADGE_STYLE[status]}`}
              >
                {approvalLabel(status)}
              </span>
            </div>
          )}
        </Link>
      ),
    };
  });

  return (
    <div className="box-border px-5 pt-2 pb-6">
      <ScreenTitle>클리닉 점검표</ScreenTitle>
      <ScrollPillRow>
        {activeDays.map((d) => (
          <PillLink key={d} href={`/staff/clinic?day=${d}`} active={d === selectedDay}>
            {d}요일
          </PillLink>
        ))}
      </ScrollPillRow>

      <SearchableRoster items={items} placeholder="이름/학교로 검색" emptyLabel="이 요일에는 학생이 없어요." />
    </div>
  );
}
