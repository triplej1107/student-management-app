import { requireStaffSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import { toISODate } from "@/lib/weeks";
import {
  activeClinicDaysFrom,
  getAttendanceMapForDate,
  getWeeklyRoster,
} from "@/lib/data";
import { DAY_ORDER } from "@/lib/types";
import { ScreenTitle, ScrollPillRow, PillLink } from "@/components/ui";
import { AttendanceRow } from "@/components/staff/AttendanceRow";
import { SearchableRoster } from "@/components/SearchableRoster";

export default async function StaffAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  await requireStaffSession();
  const { weekStart, weekEnd, dayLabel: todayLabel } = getToday();
  const { day: dayParam } = await searchParams;

  const weeklyRoster = await getWeeklyRoster(weekStart, weekEnd);
  const activeDays = activeClinicDaysFrom(weeklyRoster);
  const selectedDay = dayParam && activeDays.includes(dayParam) ? dayParam : (activeDays.includes(todayLabel) ? todayLabel : activeDays[0]);

  const roster = selectedDay ? weeklyRoster.filter((r) => r.effDay === selectedDay) : [];
  roster.sort((a, b) => a.effTime.localeCompare(b.effTime));

  const dayOffset = selectedDay ? DAY_ORDER.indexOf(selectedDay as (typeof DAY_ORDER)[number]) : 0;
  const sessionDate = new Date(weekStart);
  sessionDate.setDate(sessionDate.getDate() + dayOffset);
  const dateISO = toISODate(sessionDate);

  const attendanceMap = selectedDay ? await getAttendanceMapForDate(sessionDate) : new Map();
  const checkedCount = roster.filter((r) => attendanceMap.has(r.student.id)).length;

  return (
    <div className="box-border px-5 pt-2 pb-6">
      <ScreenTitle>출결 관리</ScreenTitle>
      <ScrollPillRow>
        {activeDays.map((d) => (
          <PillLink key={d} href={`/staff/attendance?day=${d}`} active={d === selectedDay}>
            {d}요일
          </PillLink>
        ))}
      </ScrollPillRow>

      {selectedDay && (
        <div className="mt-3.5 text-[13px] font-bold text-ink-muted">
          {checkedCount}/{roster.length}명 체크됨
        </div>
      )}

      <SearchableRoster
        placeholder="이름/학교로 검색"
        emptyLabel="이 요일에는 학생이 없어요."
        items={roster.map((entry) => ({
          key: entry.student.id,
          searchText: `${entry.student.name} ${entry.student.school ?? ""} ${entry.student.grade ?? ""}`,
          node: (
            <AttendanceRow
              student={entry.student}
              effTime={entry.effTime}
              hasMakeup={entry.hasMakeup}
              makeup={entry.makeup}
              status={attendanceMap.get(entry.student.id)}
              dateISO={dateISO}
            />
          ),
        }))}
      />
    </div>
  );
}
