import { requireZongjuSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import { toISODate, kstToday, parseISODate, dayLabelOf } from "@/lib/weeks";
import {
  activeClinicDaysFrom,
  getAttendanceMapForDate,
  getParentTextedMapForDate,
  getWeeklyRoster,
  getUnresolvedAutoAbsences,
} from "@/lib/data";
import { autoMarkLateStudents } from "@/lib/attendanceAuto";
import { DAY_ORDER } from "@/lib/types";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { ScrollPillRow, PillLink } from "@/components/ui";
import { AttendanceRow } from "@/components/staff/AttendanceRow";
import { SearchableRoster } from "@/components/SearchableRoster";
import { STUDENT_SUB_TABS } from "../subTabs";

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  await requireZongjuSession();
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

  const isViewingToday = selectedDay === todayLabel;
  let autoMarkedIds = new Set<number>();
  if (isViewingToday) {
    const result = await autoMarkLateStudents(roster, attendanceMap, sessionDate);
    attendanceMap = result.attendanceMap;
    autoMarkedIds = result.autoMarkedIds;
  }
  const checkedCount = roster.filter((r) => attendanceMap.has(r.student.id)).length;

  const autoAbsenceGroups = isViewingToday ? await getUnresolvedAutoAbsences(kstToday()) : [];
  const autoAbsenceTextedMaps = await Promise.all(
    autoAbsenceGroups.map((g) => getParentTextedMapForDate(parseISODate(g.dateISO)))
  );
  const autoAbsenceTotal = autoAbsenceGroups.reduce((sum, g) => sum + g.entries.length, 0);

  return (
    <div>
      <AdminSubNav tabs={STUDENT_SUB_TABS} />

      <div className="mt-4 text-[19px] font-extrabold text-ink">클리닉 출결 관리</div>
      <div className="mt-1 text-xs text-ink-muted">학생이 클리닉 일자 변경을 요청하면 여기서 바로 조정할 수 있어요.</div>

      <ScrollPillRow>
        {activeDays.map((d) => (
          <PillLink key={d} href={`/admin/students/attendance?day=${d}`} active={d === selectedDay}>
            {d}요일
          </PillLink>
        ))}
      </ScrollPillRow>

      {selectedDay && (
        <div className="mt-3.5 text-[13px] font-bold text-ink-muted">
          {checkedCount}/{roster.length}명 체크됨
        </div>
      )}

      {autoAbsenceTotal > 0 && (
        <div className="mt-3.5">
          <div className="mb-2 text-[13px] font-bold text-danger">
            ⚠️ 자동 결석 처리됨 · 확인 필요 ({autoAbsenceTotal}명)
          </div>
          {autoAbsenceGroups.map((group, gi) => {
            const d = parseISODate(group.dateISO);
            return (
              <div key={group.dateISO} className="mb-2.5">
                <div className="mb-1.5 text-[11px] font-bold text-ink-muted">
                  {d.getMonth() + 1}/{d.getDate()} ({dayLabelOf(d)}) · {group.entries.length}명
                </div>
                <div className="flex flex-col gap-2">
                  {group.entries.map((entry) => (
                    <AttendanceRow
                      key={entry.student.id}
                      student={entry.student}
                      effTime={entry.effTime}
                      hasMakeup={entry.hasMakeup}
                      makeup={entry.makeup}
                      status="결석"
                      dateISO={group.dateISO}
                      parentTexted={autoAbsenceTextedMaps[gi]?.get(entry.student.id)}
                      autoMarked
                    />
                  ))}
                </div>
              </div>
            );
          })}
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
