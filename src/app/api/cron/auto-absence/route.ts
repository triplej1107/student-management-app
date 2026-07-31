import "server-only";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getRosterForDate, getAttendanceMapForDate } from "@/lib/data";
import { getAutoMarkedSetForDate } from "@/lib/attendanceAuto";
import { buildAutoAbsentMessage } from "@/lib/attendanceMessages";
import { getPushSubscriptionsForStudents, sendAttendancePush } from "@/lib/clinicPush";
import { kstToday, toISODate } from "@/lib/weeks";
import { isDeployedEnvironment } from "@/lib/env";

/** Vercel Cron이 매일 22:00 KST(vercel.json, "0 13 * * *")에 호출 — 오늘
 * 클리닉이 있었는데 (1) 출결이 아예 안 눌렸거나 (2) 클리닉 시각이 지나
 * 자동으로 "지각" 처리된 뒤 아무도 확인·정정하지 않은 학생을 자동으로
 * 결석 처리한다(auto_marked=true). 사람이 직접 출석/지각/조정/결석을
 * 눌렀던 기록은(auto_marked=false) 그대로 둔다. 자동 결석 처리된 건은
 * 다음 날 출결 화면 맨 위 "확인 필요" 목록에 뜬다. */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = kstToday();
  const todayISO = toISODate(today);

  const [roster, attendanceMap, autoMarkedIds] = await Promise.all([
    getRosterForDate(today),
    getAttendanceMapForDate(today),
    getAutoMarkedSetForDate(today),
  ]);

  // 아예 미출결이거나, 자동 지각인 채 아무도 확인 안 한 학생 — 전부 자동 결석 대상.
  const toConvert = roster.filter(
    (r) => !attendanceMap.has(r.student.id) || autoMarkedIds.has(r.student.id)
  );

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

  const subsByStudent = await getPushSubscriptionsForStudents(toConvert.map((r) => r.student.id));
  let pushedTo = 0;
  for (const r of toConvert) {
    const subs = subsByStudent.get(r.student.id);
    if (subs && subs.length > 0) {
      await sendAttendancePush(subs, r.student.name, buildAutoAbsentMessage(r.effDay, r.effTime));
      pushedTo++;
    }
  }

  return NextResponse.json({ ok: true, autoMarked: toConvert.length, pushedTo });
}
