import { requireStaffSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import { toISODate, kstToday } from "@/lib/weeks";
import {
  activeClinicDaysFrom,
  getAttendanceMapForDate,
  getParentTextedMapForDate,
  getWeeklyRoster,
  getAutoAbsentRosterForDate,
} from "@/lib/data";
import { autoMarkLateStudents } from "@/lib/attendanceAuto";
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

  let attendanceMap = selectedDay ? await getAttendanceMapForDate(sessionDate) : new Map();
  const parentTextedMap = selectedDay ? await getParentTextedMapForDate(sessionDate) : new Map();

  // 오늘 탭을 보고 있을 때만: 클리닉 시각이 지났는데 미출석인 학생을 자동
  // 지각 처리하고, 어제 자동 결석 처리된 학생을 맨 위에 "확인 필요"로 올린다.
  const isViewingToday = selectedDay === todayLabel;
  let autoMarkedIds = new Set<number>();
  if (isViewingToday) {
    const result = await autoMarkLateStudents(roster, attendanceMap, sessionDate);
    attendanceMap = result.attendanceMap;
    autoMarkedIds = result.autoMarkedIds;
  }
  const checkedCount = roster.filter((r) => attendanceMap.has(r.student.id)).length;

  const yesterday = new Date(kstToday());
  yesterday.setDate(yesterday.getDate() - 1);
  const [autoAbsentRoster, autoAbsentTextedMap] = isViewingToday
    ? await Promise.all([getAutoAbsentRosterForDate(yesterday), getParentTextedMapForDate(yesterday)])
    : [[], new Map<number, boolean>()];
  const yesterdayISO = toISODate(yesterday);

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

      {autoAbsentRoster.length > 0 && (
        <div className="mt-3.5">
          <div className="mb-2 text-[13px] font-bold text-danger">
            ⚠️ 어제 자동 결석 처리됨 · 확인 필요 ({autoAbsentRoster.length}명)
          </div>
          <div className="flex flex-col gap-2">
            {autoAbsentRoster.map((entry) => (
              <AttendanceRow
                key={entry.student.id}
                student={entry.student}
                effTime={entry.effTime}
                hasMakeup={entry.hasMakeup}
                makeup={entry.makeup}
                status="결석"
                dateISO={yesterdayISO}
                parentTexted={autoAbsentTextedMap.get(entry.student.id)}
                autoMarked
              />
            ))}
          </div>
          <div className="mt-3 border-b border-line-soft pb-1" />
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
              parentTexted={parentTextedMap.get(entry.student.id)}
              autoMarked={autoMarkedIds.has(entry.student.id)}
            />
          ),
        }))}
      />
    </div>
  );
}
