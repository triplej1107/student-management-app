import Link from "next/link";
import { requireStaffSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import {
  getAttendanceMapForDate,
  getClinicChecksForStudents,
  getClinicTemplatesForWeek,
  getDutyChecksForStaffDate,
  getRosterForDay,
  getStaffById,
  listDutyItems,
  listNoticesForClass,
} from "@/lib/data";
import { isClinicComplete } from "@/lib/clinicProgress";
import { getUnseenStaffFeedback } from "@/lib/staffFeedback";
import { getTodayActiveReminders } from "@/lib/reminders";
import { listOpenOnboardings } from "@/lib/newStudents";
import { toISODate } from "@/lib/weeks";
import { CLASSES } from "@/lib/types";
import { Card } from "@/components/ui";
import { StaffHomeModals } from "@/components/StaffHomeModals";
import { ReminderBadges } from "@/components/ReminderBadges";
import { NewStudentChecklist } from "@/components/NewStudentChecklist";
import { ExamTimerBoard } from "@/components/staff/ExamTimerBoard";
import { listTodayExamTimers } from "@/lib/examTimers";
import { logoutAction } from "@/app/login/actions";
import { markStaffFeedbackSeenAction } from "@/app/staff/actions";

export default async function StaffHomePage() {
  const session = await requireStaffSession();
  const { today, weekStart, weekEnd, clinicWeekStart, dayLabel } = getToday();

  const [staff, roster, attendanceMap, dutyItems, dutyChecks, noticeLists, unseenFeedback, reminders] =
    await Promise.all([
      getStaffById(session.staffId),
      getRosterForDay(dayLabel, weekStart, weekEnd),
      getAttendanceMapForDate(today),
      listDutyItems(),
      getDutyChecksForStaffDate(session.staffId, today),
      Promise.all(CLASSES.map((c) => listNoticesForClass(c, 2))),
      getUnseenStaffFeedback(session.staffId),
      getTodayActiveReminders(toISODate(today)),
    ]);
  const [onboardings, examTimers] = await Promise.all([
    listOpenOnboardings(),
    listTodayExamTimers(),
  ]);
  // 실제로 온 학생 수만 — 조정·지각은 아직 안 온 상태다(출결 화면과 동일 기준).
  const attendedCount = roster.filter((r) => attendanceMap.get(r.student.id) === "출석").length;
  const dutyDone = dutyItems.filter((i) => dutyChecks.get(i.id)).length;
  const notices = noticeLists
    .flat()
    .sort((a, b) => (a.notice_date < b.notice_date ? 1 : -1))
    .slice(0, 2);

  const [checksMap, templatesMap] = await Promise.all([
    getClinicChecksForStudents(
      roster.map((r) => r.student.id),
      clinicWeekStart
    ),
    getClinicTemplatesForWeek(clinicWeekStart),
  ]);
  const incompleteCount = roster.filter((r) => {
    const template = r.student.class_key ? templatesMap.get(r.student.class_key) : undefined;
    if (!template) return false; // 원본 미등록 학생은 "미완료" 집계에서 제외
    return !isClinicComplete(template, checksMap.get(r.student.id));
  }).length;

  const dateLabel = `${today.getMonth() + 1}월 ${today.getDate()}일 ${dayLabel}요일`;

  return (
    <div className="box-border px-5 pt-2 pb-6">
      <ReminderBadges reminders={reminders} />

      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-extrabold text-ink">
            안녕하세요, {staff?.name ?? ""} 조교님
          </div>
          <div className="mt-1 text-[13px] text-ink-muted">{dateLabel}</div>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-sm text-ink-secondary"
            aria-label="로그아웃"
          >
            ↩
          </button>
        </form>
      </div>

      <StaffHomeModals feedback={unseenFeedback} markSeenAction={markStaffFeedbackSeenAction} />

      <NewStudentChecklist onboardings={onboardings} />

      <div className="mt-[22px] flex flex-col gap-3">
        <Link href="/staff/attendance">
          <Card clickable>
            <div className="text-[13px] font-semibold text-ink-muted">{dayLabel}요일 출결</div>
            <div className="mt-1 text-[22px] font-extrabold text-ink">
              {attendedCount}/{roster.length}명 체크됨
            </div>
          </Card>
        </Link>
        <div className="flex gap-3">
          <Link href="/staff/clinic" className="flex-1">
            <Card clickable>
              <div className="text-[13px] font-semibold text-ink-muted">클리닉 미완료</div>
              <div className="mt-1 text-[22px] font-extrabold text-ink">{incompleteCount}명</div>
            </Card>
          </Link>
          <Link href="/staff/checklist" className="flex-1">
            <Card clickable>
              <div className="text-[13px] font-semibold text-ink-muted">업무 체크리스트</div>
              <div className="mt-1 text-[22px] font-extrabold text-ink">
                {dutyDone}/{dutyItems.length}
              </div>
            </Card>
          </Link>
        </div>

        <ExamTimerBoard timers={examTimers} />

        <div className="mt-3.5">
          <div className="mb-2.5 text-sm font-bold text-ink">공지사항</div>
          {notices.length === 0 && (
            <div className="text-[13px] text-ink-muted/70">등록된 공지가 없어요.</div>
          )}
          {notices.map((n) => (
            <Card key={n.id} className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-ink">{n.title}</div>
              <div className="text-xs text-ink-muted">{n.notice_date}</div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
