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
  listStudents,
} from "@/lib/data";
import { isClinicComplete } from "@/lib/clinicProgress";
import { getUnseenStaffFeedback } from "@/lib/staffFeedback";
import { getTodayActiveReminders } from "@/lib/reminders";
import { listOpenOnboardings } from "@/lib/newStudents";
import { toISODate } from "@/lib/weeks";
import { Card } from "@/components/ui";
import { StaffHomeModals } from "@/components/StaffHomeModals";
import { ReminderBadges } from "@/components/ReminderBadges";
import { NewStudentChecklist } from "@/components/NewStudentChecklist";
import { ExamTimerBoard } from "@/components/staff/ExamTimerBoard";
import { StaffQuestBanner } from "@/components/staff/StaffQuestBanner";
import { DutyChecklist } from "@/components/staff/DutyChecklist";
import { DutyNagModal } from "@/components/staff/DutyNagModal";
import { listTodayExamTimers } from "@/lib/examTimers";
import { getStaffQuests } from "@/lib/quests";
import { isDutyNagTime } from "@/lib/lectureRules";
import { nowKST } from "@/lib/weeks";
import { logoutAction } from "@/app/login/actions";
import { markStaffFeedbackSeenAction } from "@/app/staff/actions";

export default async function StaffHomePage() {
  const session = await requireStaffSession();
  const { today, weekStart, weekEnd, clinicWeekStart, dayLabel } = getToday();

  const [staff, roster, attendanceMap, dutyItems, dutyChecks, unseenFeedback, reminders] =
    await Promise.all([
      getStaffById(session.staffId),
      getRosterForDay(dayLabel, weekStart, weekEnd),
      getAttendanceMapForDate(today),
      listDutyItems(),
      getDutyChecksForStaffDate(session.staffId, today),
      getUnseenStaffFeedback(session.staffId),
      getTodayActiveReminders(toISODate(today)),
    ]);
  const [onboardings, examTimers, allStudents, quests] = await Promise.all([
    listOpenOnboardings(),
    listTodayExamTimers(),
    listStudents({ enrolledOnly: true }),
    getStaffQuests(),
  ]);
  // 타이머 이름칸 자동완성용. 학교·학년까지 같이 넘겨야 내신 기간에 생기는
  // 동명이인을 조교가 골라낼 수 있다.
  const timerStudents = allStudents.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.student_code,
    detail: [s.school, s.grade ? `${s.grade}학년` : null].filter(Boolean).join(" "),
  }));
  // 실제로 온 학생 수만 — 조정·지각은 아직 안 온 상태다(출결 화면과 동일 기준).
  const attendedCount = roster.filter((r) => attendanceMap.get(r.student.id) === "출석").length;
  const dutyDone = dutyItems.filter((i) => dutyChecks.get(i.id)).length;
  const initialChecked = Object.fromEntries(
    dutyItems.map((i) => [i.id, dutyChecks.get(i.id) ?? false])
  );
  // 밤 9시 30분이 지났는데 아직 남아 있으면 알림창을 띄운다.
  const kst = nowKST();
  const nagging =
    isDutyNagTime(kst.getUTCHours() * 60 + kst.getUTCMinutes()) && dutyDone < dutyItems.length;

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
      <StaffQuestBanner quests={quests} />

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

      {nagging && (
        <DutyNagModal dateISO={toISODate(today)} remaining={dutyItems.length - dutyDone} />
      )}

      <StaffHomeModals feedback={unseenFeedback} markSeenAction={markStaffFeedbackSeenAction} />

      <NewStudentChecklist onboardings={onboardings} />

      <div className="mt-[22px] flex flex-col gap-3">
        <Link href="/staff/attendance">
          <Card clickable>
            <div className="text-[13px] font-semibold text-ink-muted">{dayLabel}요일 클리닉 출결</div>
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
          <Link href="/staff/lecture-attendance" className="flex-1">
            <Card clickable>
              <div className="text-[13px] font-semibold text-ink-muted">강의 출결</div>
              <div className="mt-1 text-[22px] font-extrabold text-ink">보러가기 →</div>
            </Card>
          </Link>
        </div>

        <ExamTimerBoard timers={examTimers} students={timerStudents} />

        {/* 공지사항은 학생·학부모용이라 조교 홈에서 뺐다. 그 자리에 매일 쓰는
            업무 체크리스트를 바로 체크할 수 있게 넣는다. */}
        <div className="mt-3.5">
          <div className="mb-2.5 flex items-baseline justify-between">
            <div className="text-sm font-bold text-ink">업무 체크리스트</div>
            <div className="text-xs font-bold text-ink-muted">
              {dutyDone}/{dutyItems.length}
            </div>
          </div>
          <DutyChecklist
            items={dutyItems}
            initialChecked={initialChecked}
            dateISO={toISODate(today)}
          />
        </div>
      </div>
    </div>
  );
}
