import Link from "next/link";
import { requireZongjuSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import {
  getAttendanceMapForDate,
  getClinicChecksForStudents,
  getClinicTemplatesForWeek,
  getDutyChecksForDate,
  getDutySubstitutesForDates,
  getRosterForDay,
  listDutyItems,
  listStaff,
} from "@/lib/data";
import { isClinicComplete } from "@/lib/clinicProgress";
import { getClinicBacklog } from "@/lib/clinicBacklog";
import { Card } from "@/components/ui";
import { DutySubstituteSection } from "@/components/admin/DutySubstituteSection";
import { addDutySubstituteAction, removeDutySubstituteAction } from "./actions";
import { DAY_ORDER } from "@/lib/types";
import { toISODate } from "@/lib/weeks";

const PRIORITY_DAYS = ["수", "목", "금", "토", "일", "월", "화"] as const;

export default async function AdminHomePage() {
  await requireZongjuSession();
  const { today, weekStart, weekEnd, clinicWeekStart, dayLabel } = getToday();

  const priorityDates = PRIORITY_DAYS.map((day) => {
    const offset = DAY_ORDER.indexOf(day);
    const date = new Date(weekStart);
    date.setDate(date.getDate() + offset);
    return date;
  });

  const [roster, attendanceMap, staff, dutyItems, dutyChecksByDay, substitutesByDate] = await Promise.all([
    getRosterForDay(dayLabel, weekStart, weekEnd),
    getAttendanceMapForDate(today),
    listStaff(),
    listDutyItems(),
    Promise.all(
      PRIORITY_DAYS.map(async (day, i) => ({
        day,
        date: priorityDates[i],
        checksByStaff: await getDutyChecksForDate(priorityDates[i]),
      }))
    ),
    getDutySubstitutesForDates(priorityDates),
  ]);
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const attendedCount = roster.filter((r) => attendanceMap.has(r.student.id)).length;

  const [checksMap, templatesMap] = await Promise.all([
    getClinicChecksForStudents(
      roster.map((r) => r.student.id),
      clinicWeekStart
    ),
    getClinicTemplatesForWeek(clinicWeekStart),
  ]);
  const incompleteCount = roster.filter((r) => {
    const template = r.student.class_key ? templatesMap.get(r.student.class_key) : undefined;
    if (!template) return false;
    return !isClinicComplete(template, checksMap.get(r.student.id));
  }).length;

  const pendingApprovalCount = roster.filter((r) => {
    const check = checksMap.get(r.student.id);
    return check?.staff_approved && !check.zongju_approved;
  }).length;

  const backlog = await getClinicBacklog();
  const backlogUrgentCount = backlog.filter((e) => e.weeksOverdue >= 2).length;

  const dateLabel = `${today.getMonth() + 1}월 ${today.getDate()}일 ${dayLabel}요일`;

  return (
    <div>
      <div className="mt-1 text-[13px] text-ink-muted">{dateLabel}</div>

      <div className="mt-4 flex flex-col gap-3">
        <Card>
          <div className="text-[13px] font-semibold text-ink-muted">{dayLabel}요일 출결</div>
          <div className="mt-1 text-[22px] font-extrabold text-ink">
            {attendedCount}/{roster.length}명 체크됨
          </div>
        </Card>
        <div className="flex gap-3">
          <Card className="flex-1">
            <div className="text-[13px] font-semibold text-ink-muted">클리닉 미완료</div>
            <div className="mt-1 text-[22px] font-extrabold text-ink">{incompleteCount}명</div>
          </Card>
          <Link href="/admin/students/approvals" className="flex-1">
            <Card clickable>
              <div className="text-[13px] font-semibold text-ink-muted">결재 대기</div>
              <div className="mt-1 text-[22px] font-extrabold text-ink">{pendingApprovalCount}명</div>
            </Card>
          </Link>
        </div>

        <Link href="/admin/clinic-backlog">
          <Card clickable className={backlogUrgentCount > 0 ? "border-danger/40 bg-danger-soft" : ""}>
            <div
              className={
                "text-[13px] font-semibold " +
                (backlogUrgentCount > 0 ? "text-danger" : "text-ink-muted")
              }
            >
              클리닉 밀림 관리
            </div>
            <div className="mt-1 text-[22px] font-extrabold text-ink">
              {backlog.length}명 밀림
              {backlogUrgentCount > 0 && (
                <span className="ml-1.5 text-sm font-bold text-danger">· 2주+ {backlogUrgentCount}명</span>
              )}
            </div>
          </Card>
        </Link>

        <div className="mt-2">
          <div className="mb-2.5 text-sm font-bold text-ink">요일별 조교 업무 체크리스트 현황</div>
          {staff.length === 0 && (
            <div className="text-[13px] text-ink-muted/70">등록된 조교가 없어요.</div>
          )}
          <div className="flex flex-col gap-3">
            {dutyChecksByDay.map(({ day, date, checksByStaff }) => {
              const dateISO = toISODate(date);
              const dayStaff = staff.filter((s) => s.work_days.includes(day));
              const subIds = substitutesByDate.get(dateISO) ?? [];
              const substituteRows = subIds
                .map((id) => staffById.get(id))
                .filter((s): s is NonNullable<typeof s> => !!s)
                .map((s) => {
                  const checks = checksByStaff.get(s.id);
                  const done = dutyItems.filter((i) => checks?.get(i.id)).length;
                  return { staffId: s.id, name: s.name, done, total: dutyItems.length };
                });
              const excludeIds = new Set([...dayStaff.map((s) => s.id), ...subIds]);
              const options = staff.filter((s) => !excludeIds.has(s.id)).map((s) => ({ id: s.id, name: s.name }));

              return (
                <div key={day}>
                  <div className="mb-1.5 text-xs font-bold text-ink-muted">
                    {day}요일 · {date.getMonth() + 1}/{date.getDate()}
                  </div>
                  <div className="flex flex-col gap-2">
                    {dayStaff.map((s) => {
                      const checks = checksByStaff.get(s.id);
                      const done = dutyItems.filter((i) => checks?.get(i.id)).length;
                      const complete = dutyItems.length > 0 && done === dutyItems.length;
                      return (
                        <Card key={s.id} className="flex items-center justify-between">
                          <div className="text-sm font-semibold text-ink">{s.name}</div>
                          <span
                            className={
                              "rounded-full px-2.5 py-1 text-xs font-bold " +
                              (complete ? "bg-success-soft text-success" : "bg-line-soft text-ink-muted")
                            }
                          >
                            {done}/{dutyItems.length}
                          </span>
                        </Card>
                      );
                    })}
                    <DutySubstituteSection
                      dateISO={dateISO}
                      substitutes={substituteRows}
                      options={options}
                      addAction={addDutySubstituteAction}
                      removeAction={removeDutySubstituteAction}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
