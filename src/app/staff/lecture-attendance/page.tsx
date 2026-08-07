import { requireStaffSession } from "@/lib/authz";
import { getToday } from "@/lib/today";
import { toISODate, parseISODate, dayLabelOf } from "@/lib/weeks";
import { getLectureAttendanceBoard, getSyncStatusLabel } from "@/lib/lectureAttendance";
import { getBacklogWeeksByStudent } from "@/lib/clinicBacklog";
import { ScreenTitle } from "@/components/ui";
import { LectureAttendanceBoard } from "@/components/staff/LectureAttendanceBoard";
import { LectureDatePicker } from "@/components/staff/LectureDatePicker";

export default async function StaffLectureAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireStaffSession();
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
    <div className="box-border px-5 pt-2 pb-6">
      <ScreenTitle>강의 출결</ScreenTitle>
      <div className="mt-1 text-xs text-ink-muted">
        키오스크 기록이 자동으로 들어와요. 안 잡힌 학생은 직접 눌러서 고치면 됩니다.
      </div>

      <LectureDatePicker basePath="/staff/lecture-attendance" dateISO={dateISO} />

      <div className="mt-2 text-[11px] text-ink-muted">
        {dateISO} ({dayLabelOf(selected)}) ·{" "}
        {syncedAt ? `마지막 자동 동기화 ${syncedAt}` : "아직 자동 동기화 기록이 없어요"}
      </div>

      <LectureAttendanceBoard
        dateISO={dateISO}
        dayLabel={dayLabelOf(selected)}
        entries={entries}
        clinicHrefBase="/staff/clinic"
        backlogWeeks={Object.fromEntries(backlogMap)}
      />
    </div>
  );
}
