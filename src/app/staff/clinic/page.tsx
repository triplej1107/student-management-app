import Link from "next/link";
import { requireStaffSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import {
  activeClinicDaysFrom,
  getClinicChecksForStudents,
  getClinicTemplatesForWeek,
  getWeeklyRoster,
} from "@/lib/data";
import { clinicProgressLabel, isClinicComplete } from "@/lib/clinicProgress";
import { ScreenTitle, ScrollPillRow, PillLink, EmptyState } from "@/components/ui";

export default async function StaffClinicListPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  await requireStaffSession();
  const { weekStart, weekEnd, dayLabel: todayLabel } = getToday();
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
      weekStart
    ),
    getClinicTemplatesForWeek(weekStart),
  ]);

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

      <div className="mt-3.5 flex flex-col gap-2.5">
        {roster.length === 0 && <EmptyState>이 요일에는 학생이 없어요.</EmptyState>}
        {roster.map(({ student, effTime }) => {
          const template = student.class_key ? templatesMap.get(student.class_key) : undefined;
          const check = checksMap.get(student.id);
          const label = clinicProgressLabel(template, check);
          const complete = template ? isClinicComplete(template, check) : false;
          return (
            <Link
              key={student.id}
              href={`/staff/clinic/${student.id}`}
              className="flex items-center justify-between rounded-2xl border border-line-soft bg-white p-3.5"
            >
              <div>
                <div className="text-[15px] font-bold text-ink">{student.name}</div>
                <div className="mt-0.5 text-xs text-ink-muted">{effTime}</div>
              </div>
              <span
                className={
                  "rounded-full px-2.5 py-1.5 text-xs font-bold " +
                  (label === "원본 없음"
                    ? "bg-line-soft text-ink-muted"
                    : complete
                      ? "bg-success-soft text-success"
                      : "bg-accent-soft text-accent")
                }
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
