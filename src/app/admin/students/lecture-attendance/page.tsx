import { requireZongjuSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import { toISODate, parseISODate, dayLabelOf } from "@/lib/weeks";
import { getLectureAttendanceBoard, getSyncStatusLabel } from "@/lib/lectureAttendance";
import { getBacklogWeeksByStudent } from "@/lib/clinicBacklog";
import { AdminGroupedSubNav } from "@/components/admin/AdminTopNav";
import { LectureAttendanceBoard } from "@/components/staff/LectureAttendanceBoard";
import { LectureDatePicker } from "@/components/staff/LectureDatePicker";
import { STUDENT_TAB_GROUPS } from "../subTabs";

export default async function AdminLectureAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireZongjuSession();
  const { today } = getToday();
  const { date } = await searchParams;
  const selected = date ? parseISODate(date) : today;
  const dateISO = toISODate(selected);

  const [entries, syncedAt] = await Promise.all([
    getLectureAttendanceBoard(selected),
    getSyncStatusLabel(),
  ]);

  // 오늘 강의에 오는 학생만 밀림 계산 — 1주 밀림이면 노란 카드, 2주 이상이면
  // 빨간 카드. 클리닉 출결 화면과 완전히 같은 판정을 쓴다.
  const backlogMap = await getBacklogWeeksByStudent(entries.map((e) => e.studentId));

  return (
    <div>
      <AdminGroupedSubNav groups={STUDENT_TAB_GROUPS} />

      <div className="mt-4 text-[19px] font-extrabold text-ink">강의 출결</div>
      <div className="mt-1 text-xs text-ink-muted">
        조교가 체크한 내용을 확인하고, 필요하면 여기서 바로 고칠 수 있어요.
      </div>

      <LectureDatePicker basePath="/admin/students/lecture-attendance" dateISO={dateISO} />

      <div className="mt-2 text-[11px] text-ink-muted">
        {dateISO} ({dayLabelOf(selected)}) ·{" "}
        {syncedAt ? `마지막 자동 동기화 ${syncedAt}` : "아직 자동 동기화 기록이 없어요"}
      </div>

      <LectureAttendanceBoard
        dateISO={dateISO}
        dayLabel={dayLabelOf(selected)}
        entries={entries}
        clinicHrefBase="/admin/students/approvals"
        backlogWeeks={Object.fromEntries(backlogMap)}
      />
    </div>
  );
}
