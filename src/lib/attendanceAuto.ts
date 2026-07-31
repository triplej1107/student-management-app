import "server-only";
import { supabase } from "./supabase";
import type { RosterEntry } from "./data";
import type { AttendanceStatus } from "./types";
import { isPastClinicTime, toISODate } from "./weeks";
import { getPushSubscriptionsForStudents, sendAttendancePush } from "./clinicPush";

/** 클리닉 시각이 지났는데 아직 아무 출결도 안 눌린 학생을 자동으로
 * "지각"으로 기록한다(auto_marked=true — 사람이 직접 확인한 게 아니라는
 * 표시). 조교/종주T가 출결 화면을 열 때마다 그 시점 기준으로 실행되므로,
 * 초 단위로 정확하진 않고 "화면을 연 시점"에 뒤늦게 반영된다. 학생이
 * 오면 출석을 눌러 덮어쓰면 되고, 그러면 auto_marked도 자동으로 꺼진다
 * (setAttendance 참고). 반환하는 Map은 방금 반영된 값까지 합친 것 — 같은
 * 렌더링에서 바로 화면에 보여주기 위함. */
export async function autoMarkLateStudents(
  roster: RosterEntry[],
  attendanceMap: Map<number, AttendanceStatus>,
  date: Date
): Promise<{ attendanceMap: Map<number, AttendanceStatus>; autoMarkedIds: Set<number> }> {
  const late = roster.filter((r) => !attendanceMap.has(r.student.id) && isPastClinicTime(r.effTime));
  if (late.length > 0) {
    await supabase.from("attendance_records").upsert(
      late.map((r) => ({
        student_id: r.student.id,
        session_date: toISODate(date),
        status: "지각",
        marked_by: null,
        auto_marked: true,
      })),
      { onConflict: "student_id,session_date" }
    );

    const subsByStudent = await getPushSubscriptionsForStudents(late.map((r) => r.student.id));
    for (const r of late) {
      const subs = subsByStudent.get(r.student.id);
      if (subs && subs.length > 0) {
        await sendAttendancePush(
          subs,
          r.student.name,
          `${r.effDay}요일 ${r.effTime} 클리닉인데 아직 출석하지 않아 지각으로 처리됐어요.`
        );
      }
    }
  }

  const nextMap = new Map(attendanceMap);
  for (const r of late) nextMap.set(r.student.id, "지각");

  const autoMarkedIds = await getAutoMarkedSetForDate(date);
  for (const r of late) autoMarkedIds.add(r.student.id);

  return { attendanceMap: nextMap, autoMarkedIds };
}

/** 그 날짜에 auto_marked=true로 남아있는(=사람이 아직 확인 안 한) 출결
 * 기록의 student_id 집합 — 화면에 "자동 처리" 표시를 하거나, 22시 크론이
 * "아직 확인 안 된" 지각을 결석으로 전환할 대상을 고를 때 쓴다. */
export async function getAutoMarkedSetForDate(date: Date): Promise<Set<number>> {
  const { data } = await supabase
    .from("attendance_records")
    .select("student_id")
    .eq("session_date", toISODate(date))
    .eq("auto_marked", true);
  return new Set((data ?? []).map((r: { student_id: number }) => r.student_id));
}
