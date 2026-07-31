import "server-only";
import { NextResponse } from "next/server";
import { getStudentsWithBirthdayToday } from "@/lib/data";
import { grantBirthdayUjc } from "@/lib/ujc";
import { getPushSubscriptionsForStudents, sendBirthdayPush } from "@/lib/clinicPush";
import { toISODate, kstToday } from "@/lib/weeks";

/** Vercel Cron이 매일 09:00 KST(vercel.json)에 호출 — 오늘이 생일인
 * 재원생에게 UJC 1개를 지급하고 웹 푸시로 축하 메시지를 보낸다.
 * (student_id, 그 해 생일 날짜) 부분 unique 인덱스가 매년 중복 지급을
 * 막아주므로, 이미 지급된 학생은 건너뛴다(알림도 다시 보내지 않음). */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 서버가 UTC라 new Date()를 쓰면 한국 날짜와 어긋날 수 있다(today.ts 참고).
  const today = kstToday();
  const todayISO = toISODate(today);
  const students = await getStudentsWithBirthdayToday(today);
  const subsByStudent = await getPushSubscriptionsForStudents(students.map((s) => s.id));

  let grantedCount = 0;
  for (const s of students) {
    const granted = await grantBirthdayUjc(s.id, todayISO);
    if (!granted) continue; // 이미 올해 지급됨
    grantedCount++;
    const subs = subsByStudent.get(s.id);
    if (subs && subs.length > 0) {
      await sendBirthdayPush(subs, s.name);
    }
  }

  return NextResponse.json({ ok: true, birthdayCount: students.length, grantedCount });
}
