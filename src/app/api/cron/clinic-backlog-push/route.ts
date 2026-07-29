import "server-only";
import { NextResponse } from "next/server";
import { getClinicBacklog } from "@/lib/clinicBacklog";
import { getPushSubscriptionsForStudents, sendClinicBacklogPush } from "@/lib/clinicPush";

/** Vercel Cron이 매주 월요일 09:00 KST(vercel.json)에 호출 — 밀림이 있는
 * 모든 학생(1주 밀림 + 2주 이상)에게 자동으로 웹 푸시를 보낸다.
 * 2주 이상은 문구가 더 강한 경고로 바뀌고, 동시에 종주T/조교의
 * /admin(/staff)/clinic-backlog 전화 연락 관리 대상이기도 하다. */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const entries = await getClinicBacklog();
  const subsByStudent = await getPushSubscriptionsForStudents(entries.map((e) => e.studentId));

  let sentTo = 0;
  for (const e of entries) {
    const subs = subsByStudent.get(e.studentId);
    if (subs && subs.length > 0) {
      await sendClinicBacklogPush(subs, e.weeksOverdue);
      sentTo++;
    }
  }

  return NextResponse.json({
    ok: true,
    backlogCount: entries.length,
    oneWeekCount: entries.filter((e) => e.weeksOverdue === 1).length,
    twoPlusCount: entries.filter((e) => e.weeksOverdue >= 2).length,
    pushedTo: sentTo,
  });
}
