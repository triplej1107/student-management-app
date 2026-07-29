import "server-only";
import { NextResponse } from "next/server";
import { getClinicBacklog } from "@/lib/clinicBacklog";
import { getPushSubscriptionsForStudents, sendClinicBacklogPush } from "@/lib/clinicPush";

/** Vercel Cron이 매주 월요일 09:00 KST(vercel.json)에 호출 — 1주 밀림인
 * 학생들에게 자동으로 웹 푸시를 보낸다. 2주 이상은 여기서 다루지 않고
 * /admin/clinic-backlog의 전화 연락 관리로 넘어간다. */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const entries = await getClinicBacklog();
  const oneWeek = entries.filter((e) => e.weeksOverdue === 1);
  const subsByStudent = await getPushSubscriptionsForStudents(oneWeek.map((e) => e.studentId));

  let sentTo = 0;
  for (const e of oneWeek) {
    const subs = subsByStudent.get(e.studentId);
    if (subs && subs.length > 0) {
      await sendClinicBacklogPush(subs);
      sentTo++;
    }
  }

  return NextResponse.json({ ok: true, oneWeekBacklogCount: oneWeek.length, pushedTo: sentTo });
}
