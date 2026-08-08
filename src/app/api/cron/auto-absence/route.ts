import "server-only";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getRosterForDate, getAttendanceMapForDate } from "@/lib/data";
import { buildAutoAbsentMessage } from "@/lib/attendanceMessages";
import { getPushSubscriptionsForStudents, sendAttendancePush } from "@/lib/clinicPush";
import { kstToday, toISODate } from "@/lib/weeks";
import { isDeployedEnvironment } from "@/lib/env";
import { syncSlimeWeek } from "@/lib/slimeXp";

/** Vercel Cron이 매일 22:00 KST(vercel.json, "0 13 * * *")에 호출 — 그날
 * 클리닉이 있었는데 결국 오지 않은 학생을 자동으로 결석 처리한다
 * (auto_marked=true).
 *
 * 판정 기준은 "밤 10시가 되도록 출결이 아예 안 눌린 학생" 하나뿐이다.
 *
 * **지각은 더 이상 결석으로 바꾸지 않는다.** 예전에는 지각이 "아직 안 왔음"
 * 표시라서 밤까지 남아있으면 끝내 안 온 것으로 봤다. 지금은 안 온 학생을
 * 처음부터 결석으로 찍으므로(attendanceAuto 참고), 지각은 말 그대로
 * **늦게라도 온 학생**이다. 그걸 결석으로 바꾸면 온 학생을 안 왔다고
 * 기록하게 된다.
 *
 * - "출석"/"지각"/"조정"은 그대로 둔다(왔거나, 늦게 왔거나, 다른 날로 옮겼거나).
 * - 이미 "결석"인 기록도 그대로 둔다 — 다시 덮어쓰면 알림만 중복된다.
 *
 * 그래서 이 크론은 이제 그물망이다. 출결 화면을 아무도 안 열어 자동 결석이
 * 안 찍힌 날을 받아낸다.
 *
 * 자동 결석된 건은 다음 날부터 출결 화면 맨 위 "확인 필요" 목록에 떠서,
 * 조교가 출근해 연락·조정하고 버튼을 누르면 목록에서 사라진다. */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = kstToday();
  const todayISO = toISODate(today);

  const [roster, attendanceMap] = await Promise.all([
    getRosterForDate(today),
    getAttendanceMapForDate(today),
  ]);

  const toConvert = roster.filter((r) => attendanceMap.get(r.student.id) === undefined);

  if (toConvert.length === 0) {
    return NextResponse.json({ ok: true, autoMarked: 0 });
  }

  if (!isDeployedEnvironment()) {
    console.warn(
      `[dry-run] 로컬 환경이라 실제 기록/알림 없이 미리보기만 함. 자동 결석 대상 ${toConvert.length}명: ${toConvert
        .map((r) => r.student.name)
        .join(", ")}`
    );
    return NextResponse.json({ ok: true, dryRun: true, wouldMark: toConvert.length });
  }

  await supabase.from("attendance_records").upsert(
    toConvert.map((r) => ({
      student_id: r.student.id,
      session_date: todayISO,
      status: "결석",
      marked_by: null,
      auto_marked: true,
    })),
    { onConflict: "student_id,session_date" }
  );

  // 결석 전환은 그 주의 슬라임 XP(스트릭 판정)에 영향 — 주 단위 재계산
  for (const r of toConvert) {
    await syncSlimeWeek(r.student.id, today);
  }

  const subsByStudent = await getPushSubscriptionsForStudents(toConvert.map((r) => r.student.id));
  let pushedTo = 0;
  for (const r of toConvert) {
    const subs = subsByStudent.get(r.student.id);
    if (subs && subs.length > 0) {
      // 조용시간(22시~9시) 예외 — 이 알림이 그날의 마지막 알림이다.
      await sendAttendancePush(subs, r.student.name, buildAutoAbsentMessage(r.effDay, r.effTime), {
        allowInQuietHours: true,
      });
      pushedTo++;
    }
  }

  return NextResponse.json({ ok: true, autoMarked: toConvert.length, pushedTo });
}
