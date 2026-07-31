import "server-only";
import { NextResponse } from "next/server";
import { sendMonthlyReportEmail } from "@/lib/monthlyReport";
import { kstToday } from "@/lib/weeks";

/** Vercel Cron이 매달 1일 09:00 KST(vercel.json)에 호출 — 지난달 전체
 * 학생 기록(출결/클리닉/성적/UJC)을 엑셀로 정리해 이메일로 발송한다. */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 서버가 UTC라 new Date()를 쓰면 한국 날짜와 어긋날 수 있다(today.ts 참고).
  const now = kstToday();
  const prevMonthAnchor = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prevMonthAnchor.getFullYear();
  const month = prevMonthAnchor.getMonth() + 1;

  await sendMonthlyReportEmail(year, month);

  return NextResponse.json({ ok: true, year, month });
}
