import "server-only";
import { NextResponse } from "next/server";
import {
  getRemindersDueForDayBeforePush,
  markDayBeforePushed,
  getRemindersDueForHourBeforePush,
  markHourBeforePushed,
} from "@/lib/reminders";
import {
  getPushSubscriptionsForAllStaff,
  getPushSubscriptionsForStudents,
  getPushSubscriptionsForZongju,
  sendReminderPush,
} from "@/lib/clinicPush";
import { kstToday, toISODate, nowKST } from "@/lib/weeks";
import { isDeployedEnvironment } from "@/lib/env";

/** "6시" / "6시 30분" — event_time("HH:MM")을 구어체로. */
function formatTimeKorean(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const m = Number(mStr);
  return m === 0 ? `${displayHour}시` : `${displayHour}시 ${m}분`;
}

/** GitHub Actions가 매시간 호출 — Vercel Hobby 요금제는 cron을 하루 한 번만
 * 돌릴 수 있어서 "1시간 전" 알림은 외부 스케줄러로 대체했다(reference:
 * README나 커밋 메시지 참고). 후보를 널널하게(최대 90분 전까지) 가져온
 * 뒤 여기서 실제 시각차를 계산해 걸러낸다 — 매시간 호출이 정확히 정시에
 * 오지 않아도 놓치지 않기 위한 여유분. */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = kstToday();
  const todayISO = toISODate(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowISO = toISODate(tomorrow);

  const [dayBeforeDue, hourBeforeCandidates] = await Promise.all([
    getRemindersDueForDayBeforePush(tomorrowISO),
    getRemindersDueForHourBeforePush(todayISO),
  ]);

  const k = nowKST();
  const nowMinutes = k.getUTCHours() * 60 + k.getUTCMinutes();
  const hourBeforeDue = hourBeforeCandidates.filter((r) => {
    const [h, m] = r.event_time.split(":").map(Number);
    const diff = h * 60 + m - nowMinutes;
    return diff >= 0 && diff <= 90;
  });

  if (dayBeforeDue.length === 0 && hourBeforeDue.length === 0) {
    return NextResponse.json({ ok: true, dayBefore: 0, hourBefore: 0 });
  }

  if (!isDeployedEnvironment()) {
    console.warn(
      `[dry-run] 로컬 환경이라 실제 알림 없이 미리보기만 함. 하루 전 대상 ${dayBeforeDue.length}건, 1시간 전 대상 ${hourBeforeDue.length}건`
    );
    return NextResponse.json({
      ok: true,
      dryRun: true,
      dayBefore: dayBeforeDue.length,
      hourBefore: hourBeforeDue.length,
    });
  }

  const [staffSubs, zongjuSubs] = await Promise.all([
    getPushSubscriptionsForAllStaff(),
    getPushSubscriptionsForZongju(),
  ]);

  // 학생이 연결된 건은 그 학생·학부모에게도 보낸다(같은 student_id에 묶인
  // 구독이라 학생 폰과 학부모 폰이 함께 걸린다).
  const linkedIds = [...dayBeforeDue, ...hourBeforeDue]
    .map((r) => r.student_id)
    .filter((id): id is number => id !== null);
  const subsByStudent = await getPushSubscriptionsForStudents([...new Set(linkedIds)]);

  async function fanOut(r: { student_id: number | null }, body: string) {
    const studentSubs = r.student_id ? (subsByStudent.get(r.student_id) ?? []) : [];
    await Promise.all([
      sendReminderPush(staffSubs, body, "/staff"),
      sendReminderPush(zongjuSubs, body, "/admin"),
      studentSubs.length > 0 ? sendReminderPush(studentSubs, body, "/student") : Promise.resolve(),
    ]);
  }

  for (const r of dayBeforeDue) {
    await fanOut(r, `내일 ${formatTimeKorean(r.event_time)} — ${r.content}`);
    await markDayBeforePushed(r.id);
  }

  for (const r of hourBeforeDue) {
    await fanOut(r, `1시간 뒤 ${formatTimeKorean(r.event_time)} — ${r.content}`);
    await markHourBeforePushed(r.id);
  }

  return NextResponse.json({ ok: true, dayBefore: dayBeforeDue.length, hourBefore: hourBeforeDue.length });
}
