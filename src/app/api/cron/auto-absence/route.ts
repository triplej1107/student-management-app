import "server-only";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getRosterForDate, getAttendanceMapForDate } from "@/lib/data";
import { buildAutoAbsentMessage } from "@/lib/attendanceMessages";
import { getPushSubscriptionsForStudents, sendAttendancePush } from "@/lib/clinicPush";
import { kstToday, toISODate } from "@/lib/weeks";
import { isDeployedEnvironment } from "@/lib/env";

/** Vercel Cron이 매일 22:00 KST(vercel.json, "0 13 * * *")에 호출 — 그날
 * 클리닉이 있었는데 결국 오지 않은 학생을 자동으로 결석 처리한다
 * (auto_marked=true).
 *
 * 판정 기준은 "밤 10시 시점에 출석도 조정도 아닌 상태" 하나뿐이다:
 * - 출결이 아예 안 눌린 학생 → 결석
 * - "지각"인 학생 → 결석. 이 학원에서 지각은 "아직 안 왔음" 표시이고,
 *   오면 조교가 출석으로 바꾼다. 그러니 밤까지 지각으로 남아있다는 건
 *   끝내 오지 않았다는 뜻 — 조교가 직접 누른 지각이어도 마찬가지다.
 * - "출석"/"조정"은 그대로 둔다(왔거나, 다른 날로 옮겼거나).
 * - 이미 "결석"인 기록도 그대로 둔다 — 다시 덮어쓰면 알림만 중복된다.
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

  const toConvert = roster.filter((r) => {
    const status = attendanceMap.get(r.student.id);
    return status === undefined || status === "지각";
  });

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
