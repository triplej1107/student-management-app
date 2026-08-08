import "server-only";
import { NextResponse } from "next/server";
import { fetchTodayAttendance, isMacgaiConfigured } from "@/lib/macgai7";
import {
  getLastSuccessfulSyncAt,
  recordSyncRun,
  syncLectureAttendance,
} from "@/lib/lectureAttendance";
import { isSyncStale } from "@/lib/lectureRules";
import { getPushSubscriptionsForZongju, sendReminderPush } from "@/lib/clinicPush";

/**
 * 맥가이7 등원 명단을 읽어와 강의 출결에 반영한다. GitHub Actions가 주말
 * 강의 시간대에 10분마다 호출한다(Vercel Hobby는 크론이 하루 한 번뿐이라
 * "잊지마"와 같은 방식으로 우회한다).
 *
 * 이 라우트의 몸통은 이미 다 있고, 비어 있는 것은 macgai7.ts의
 * fetchTodayCheckIns 하나뿐이다.
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
    const { checkIns, reasons } = await fetchTodayAttendance();
    const result = await syncLectureAttendance(checkIns, undefined, reasons);
    await recordSyncRun({ ok: true, fetchedCount: checkIns.length });
    return NextResponse.json({ ok: true, fetched: checkIns.length, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await recordSyncRun({ ok: false, error: message });
    await notifyIfStale();
    // 크론이 계속 재시도하도록 200으로 돌려준다 — 실패는 로그로 관리한다.
    return NextResponse.json({ ok: false, error: message });
  }
}

/** 한참 성공이 없으면 종주T에게 한 번 알린다. */
async function notifyIfStale() {
  const lastOk = await getLastSuccessfulSyncAt();
  if (!isSyncStale(lastOk, Date.now())) return;
  const subs = await getPushSubscriptionsForZongju();
  if (subs.length === 0) return;
  await sendReminderPush(
    subs,
    "강의 출결 자동 연동이 멈췄어요. 맥가이7 화면이 바뀌었을 수 있습니다.",
    "/admin/students/lecture-attendance"
  );
}
