import "server-only";
import { supabase } from "./supabase";
import type { RosterEntry } from "./data";
import type { AttendanceStatus } from "./types";
import { isPastClinicTime, toISODate } from "./weeks";
import { getPushSubscriptionsForStudents, sendAttendancePush } from "./clinicPush";
import { isDeployedEnvironment } from "./env";
import { buildNotArrivedMessage, buildAutoAbsentMessage } from "./attendanceMessages";
import { MISSING_AFTER_MINUTES } from "./lectureRules";

export { buildNotArrivedMessage, buildAutoAbsentMessage };

/** 클리닉 시각이 지났는데 아직 아무 출결도 안 눌린 학생을 자동으로
 * **"결석"**으로 기록한다(auto_marked=true — 사람이 직접 확인한 게 아니라는
 * 표시).
 *
 * 예전에는 여기서 "지각"으로 찍었다. 학원 안에서는 지각이 "아직 안 왔음"
 * 표시였지만, 학부모 중에 지각을 "늦었지만 왔다"로 읽는 분들이 있어서
 * 안 온 걸 왔다고 받아들이는 일이 생겼다. 그래서 뒤집었다 —
 * **안 오면 결석, 늦게라도 오면 지각.** 말 그대로다.
 *
 * 정시가 아니라 MISSING_AFTER_MINUTES(20분)를 넘겨야 찍는다. 결석 알림은
 * 틀리면 학부모에게 그대로 나가서, 3분 늦은 학생을 결석으로 만들면 안 된다.
 * 강의 쪽 미출석 판정과 같은 여유를 쓴다.
 *
 * 조교/종주T가 출결 화면을 열 때마다 그 시점 기준으로 실행되므로, 초 단위로
 * 정확하진 않고 "화면을 연 시점"에 뒤늦게 반영된다. 학생이 오면 출석·지각을
 * 눌러 덮어쓰면 되고, 그러면 auto_marked도 자동으로 꺼진다(setAttendance 참고).
 * 반환하는 Map은 방금 반영된 값까지 합친 것 — 같은 렌더링에서 바로 화면에
 * 보여주기 위함.
 *
 * 로컬(`next dev`/`next start`)에서는 실제 DB 쓰기·푸시를 건너뛰고 콘솔에만
 * 찍는다 — 로컬 테스트가 운영 DB를 그대로 보고 있어서, 전체 로스터를
 * 훑는 이 함수가 페이지를 열 때마다 실제 학생들에게 영향을 주면 안 되기
 * 때문(2026-07-31 실제로 이 문제로 학생 16명이 잘못 자동 처리된 적
 * 있음 — 그 사고 이후 추가된 안전장치). */
export async function autoMarkNotArrivedStudents(
  roster: RosterEntry[],
  attendanceMap: Map<number, AttendanceStatus>,
  date: Date
): Promise<{ attendanceMap: Map<number, AttendanceStatus>; autoMarkedIds: Set<number> }> {
  const notArrived = roster.filter(
    (r) => !attendanceMap.has(r.student.id) && isPastClinicTime(r.effTime, MISSING_AFTER_MINUTES)
  );
  if (notArrived.length > 0) {
    if (isDeployedEnvironment()) {
      await supabase.from("attendance_records").upsert(
        notArrived.map((r) => ({
          student_id: r.student.id,
          session_date: toISODate(date),
          status: "결석",
          marked_by: null,
          auto_marked: true,
        })),
        { onConflict: "student_id,session_date" }
      );

      const subsByStudent = await getPushSubscriptionsForStudents(
        notArrived.map((r) => r.student.id)
      );
      for (const r of notArrived) {
        const subs = subsByStudent.get(r.student.id);
        if (subs && subs.length > 0) {
          await sendAttendancePush(subs, r.student.name, buildNotArrivedMessage(r.effDay, r.effTime));
        }
      }
    } else {
      console.warn(
        `[dry-run] 로컬 환경이라 실제 기록/알림 없이 미리보기만 함. 자동 결석 대상 ${notArrived.length}명: ${notArrived
          .map((r) => r.student.name)
          .join(", ")}`
      );
    }
  }

  const nextMap = new Map(attendanceMap);
  for (const r of notArrived) nextMap.set(r.student.id, "결석");

  const autoMarkedIds = await getAutoMarkedSetForDate(date);
  for (const r of notArrived) autoMarkedIds.add(r.student.id);

  return { attendanceMap: nextMap, autoMarkedIds };
}

/** 그 날짜에 auto_marked=true로 남아있는(=사람이 아직 확인 안 한) 출결
 * 기록의 student_id 집합 — 화면에 "자동 처리" 표시를 하고, 키오스크 기록이
 * 들어오면 덮어써도 되는 줄인지 가릴 때 쓴다. */
export async function getAutoMarkedSetForDate(date: Date): Promise<Set<number>> {
  const { data } = await supabase
    .from("attendance_records")
    .select("student_id")
    .eq("session_date", toISODate(date))
    .eq("auto_marked", true);
  return new Set((data ?? []).map((r: { student_id: number }) => r.student_id));
}
