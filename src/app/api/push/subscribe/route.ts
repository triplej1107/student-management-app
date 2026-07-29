import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { savePushSubscription } from "@/lib/clinicPush";

/** 클리닉 밀림 알림은 "학생 본인"에게만 보낸다는 요구사항이라 role이
 * 정확히 student인 경우만 받는다 — parent 세션은 같은 studentId를
 * 갖지만 여기서는 거절한다. */
export async function POST(req: Request) {
  const session = await getSession();
  if (session.role !== "student" || !session.studentId) {
    return NextResponse.json({ error: "학생 계정만 알림을 받을 수 있어요." }, { status: 403 });
  }

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "잘못된 구독 정보예요." }, { status: 400 });
  }

  await savePushSubscription(session.studentId, body.endpoint, body.keys.p256dh, body.keys.auth);
  return NextResponse.json({ ok: true });
}
