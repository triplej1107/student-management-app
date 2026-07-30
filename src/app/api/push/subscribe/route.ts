import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  savePushSubscription,
  savePushSubscriptionForStaff,
  savePushSubscriptionForZongju,
} from "@/lib/clinicPush";

/** 클리닉 밀림 알림은 학생 본인과 학부모 모두에게 간다 — student/parent
 * 세션 둘 다 같은 studentId로 구독을 등록할 수 있고, 발송 시엔 그
 * studentId에 걸린 모든 구독 기기로 동일하게 보낸다. 조교는 조교 피드백
 * 알림을 받기 위해 staffId로, 종주T는 학부모 질문 알림을 받기 위해
 * is_zongju로 구독한다. */
export async function POST(req: Request) {
  const session = await getSession();

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: "잘못된 구독 정보예요." }, { status: 400 });
  }

  if ((session.role === "student" || session.role === "parent") && session.studentId) {
    await savePushSubscription(session.studentId, body.endpoint, body.keys.p256dh, body.keys.auth);
    return NextResponse.json({ ok: true });
  }
  if (session.role === "staff" && session.staffId) {
    await savePushSubscriptionForStaff(session.staffId, body.endpoint, body.keys.p256dh, body.keys.auth);
    return NextResponse.json({ ok: true });
  }
  if (session.role === "zongju") {
    await savePushSubscriptionForZongju(body.endpoint, body.keys.p256dh, body.keys.auth);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "학생/학부모/조교/종주T 계정만 알림을 받을 수 있어요." }, { status: 403 });
}
