import { requireStaffSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import { toISODate } from "@/lib/weeks";
import {
  getActiveClinicDays,
  getAttendanceMapForDate,
  getRosterForDay,
} from "@/lib/data";
import { DAY_ORDER } from "@/lib/types";
import { ScreenTitle, ScrollPillRow, PillLink, EmptyState } from "@/components/ui";
import { AttendanceRow } from "@/components/staff/AttendanceRow";

export default async function StaffAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  await requireStaffSession();
  const { weekStart, weekEnd, dayLabel: todayLabel } = getToday();
  const { day: dayParam } = await searchParams;

  const activeDays = await getActiveClinicDays(weekStart, weekEnd);
  const selectedDay = dayParam && activeDays.includes(dayParam) ? dayParam : (activeDays.includes(todayLabel) ? todayLabel : activeDays[0]);

  const roster = selectedDay ? await getRosterForDay(selectedDay, weekStart, weekEnd) : [];
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

      <div className="mt-3 flex flex-col gap-2.5">
        {roster.length === 0 && <EmptyState>이 요일에는 학생이 없어요.</EmptyState>}
        {roster.map((entry) => (
          <AttendanceRow
            key={entry.student.id}
            student={entry.student}
            effTime={entry.effTime}
            hasMakeup={entry.hasMakeup}
            makeup={entry.makeup}
            status={attendanceMap.get(entry.student.id)}
            dateISO={dateISO}
          />
        ))}
      </div>
    </div>
  );
}
