import Link from "next/link";
import { requireZongjuSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import {
  getAttendanceMapForDate,
  getClinicChecksForStudents,
  getClinicTemplatesForWeek,
  getDutyChecksForDate,
  getRosterForDay,
  listDutyItems,
  listStaff,
} from "@/lib/data";
import { isClinicComplete } from "@/lib/clinicProgress";
import { Card } from "@/components/ui";

export default async function AdminHomePage() {
  await requireZongjuSession();
  const { today, weekStart, weekEnd, dayLabel } = getToday();

  const roster = await getRosterForDay(dayLabel, weekStart, weekEnd);
  const attendanceMap = await getAttendanceMapForDate(today);
  const attendedCount = roster.filter((r) => attendanceMap.has(r.student.id)).length;

  const [checksMap, templatesMap] = await Promise.all([
    getClinicChecksForStudents(
      roster.map((r) => r.student.id),
      weekStart
    ),
    getClinicTemplatesForWeek(weekStart),
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

  const [staff, dutyItems, dutyChecksByStaff] = await Promise.all([
    listStaff(),
    listDutyItems(),
    getDutyChecksForDate(today),
  ]);

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
            <Card>
              <div className="text-[13px] font-semibold text-ink-muted">결재 대기</div>
              <div className="mt-1 text-[22px] font-extrabold text-ink">{pendingApprovalCount}명</div>
            </Card>
          </Link>
        </div>

        <div className="mt-2">
          <div className="mb-2.5 text-sm font-bold text-ink">조교별 업무 체크리스트 현황</div>
          {staff.length === 0 && (
            <div className="text-[13px] text-ink-muted/70">등록된 조교가 없어요.</div>
          )}
          <div className="flex flex-col gap-2">
            {staff.map((s) => {
              const checks = dutyChecksByStaff.get(s.id);
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
          </div>
        </div>
      </div>
    </div>
  );
}
