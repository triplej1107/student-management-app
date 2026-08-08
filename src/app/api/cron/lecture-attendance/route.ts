import "server-only";
import { NextResponse } from "next/server";
import { fetchTodayAttendance, isMacgaiConfigured } from "@/lib/macgai7";
import {
  getLastSuccessfulSyncAt,
  recordSyncRun,
  syncLectureAttendance,
} from "@/lib/lectureAttendance";
import { shouldNotifyStale } from "@/lib/lectureRules";
import { getPushSubscriptionsForZongju, sendReminderPush } from "@/lib/clinicPush";
import { nowKST } from "@/lib/weeks";

/** 맥가이7을 여러 번 왕복한다(로그인·세션·학급·출결·등하원 로그). 기본
 * 제한시간 안에 못 끝내면 함수가 통째로 죽어서 **실패 기록조차 안 남는다.** */
export const maxDuration = 60;

/**
 * 맥가이7 등하원 명단을 읽어와 강의·클리닉 출결에 반영한다.
 *
 * Vercel Cron이 한국 시간 09:00~23:55에 5분마다 부른다(vercel.json).
 * 한동안 GitHub Actions로 우회했었는데, "Hobby 요금제는 크론이 하루 한 번"이라는
 * 잘못된 전제 때문이었다. 실제로는 Pro라 1분 단위까지 된다. GitHub의 예약은
 * 부하가 걸리면 조용히 버려져서(2026-08-08에 하루 2번만 돌았다) 그 우회가
 * 오히려 사고의 원인이었다.
 *
 * 성공/실패를 매번 macgai_sync_log에 남긴다 — 맥가이7이 화면을 개편하면
 * 긁어오기가 **조용히** 멈추기 때문에, 아무도 모르는 상태가 제일 위험하다.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 아직 계정이 안 붙었으면 실패로 쌓지 않는다 — 연동 전부터 "죽었다"는
  // 알림이 울리면 진짜 고장과 구분이 안 된다.
  if (!isMacgaiConfigured()) {
    return NextResponse.json({ skipped: "맥가이7 계정이 설정되지 않았습니다." });
  }

  try {
    const { checkIns, reasons, logCount, logError } = await fetchTodayAttendance();
    const result = await syncLectureAttendance(checkIns, undefined, reasons);
    await recordSyncRun({ ok: true, fetchedCount: checkIns.length });
    // logCount는 등하원 로그에서 읽은 줄 수다. 이게 0으로 계속 나오면 클리닉
    // 자동 출결이 조용히 안 도는 것이니, 확인할 때 제일 먼저 볼 값이다.
    return NextResponse.json({ ok: true, fetched: checkIns.length, logCount, logError, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordSyncRun({ ok: false, error: message });
    await notifyIfStale();
    // 크론이 계속 재시도하도록 200으로 돌려준다 — 실패는 로그로 관리한다.
    return NextResponse.json({ ok: false, error: message });
  }
}

/** 한참 성공이 없으면 종주T에게 알린다 — **시간당 한 번까지만.**
 * 동기화는 5분마다 도는데 끊기면 매번 죽은 상태라, 제한이 없으면 폰이
 * 시간당 12번 울린다(shouldNotifyStale 참고). */
async function notifyIfStale() {
  const lastOk = await getLastSuccessfulSyncAt();
  if (!shouldNotifyStale(lastOk, Date.now(), nowKST().getUTCMinutes())) return;
  const subs = await getPushSubscriptionsForZongju();
  if (subs.length === 0) return;
  await sendReminderPush(
    subs,
    "강의 출결 자동 연동이 멈췄어요. 맥가이7 화면이 바뀌었을 수 있습니다.",
    "/admin/students/lecture-attendance"
  );
}
