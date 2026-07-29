import "server-only";
import webpush from "web-push";
import { supabase } from "./supabase";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
  webpush.setVapidDetails("mailto:triplej1107@gmail.com", publicKey, privateKey);
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function savePushSubscription(
  studentId: number,
  endpoint: string,
  p256dh: string,
  auth: string
) {
  await supabase
    .from("push_subscriptions")
    .upsert({ student_id: studentId, endpoint, p256dh, auth }, { onConflict: "endpoint" });
}

export async function getPushSubscriptionsForStudents(
  studentIds: number[]
): Promise<Map<number, PushSubscriptionRow[]>> {
  const map = new Map<number, PushSubscriptionRow[]>();
  if (studentIds.length === 0) return map;
  const { data } = await supabase
    .from("push_subscriptions")
    .select("student_id, endpoint, p256dh, auth")
    .in("student_id", studentIds);
  for (const row of data ?? []) {
    const list = map.get(row.student_id) ?? [];
    list.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
    map.set(row.student_id, list);
  }
  return map;
}

/** 밀린 클리닉 알림을 학생의 모든 구독 기기에 보낸다. weeksOverdue가
 * 2 이상이면 더 강한 경고 문구를 쓴다. 더 이상 유효하지 않은 구독
 * (410 Gone/404)은 조용히 지운다. */
export async function sendClinicBacklogPush(subs: PushSubscriptionRow[], weeksOverdue: number) {
  if (!publicKey || !privateKey || subs.length === 0) return;

  const payload = JSON.stringify(
    weeksOverdue >= 2
      ? {
          title: "⚠️ 클리닉 점검표 경고",
          body: `클리닉 숙제·테스트가 ${weeksOverdue}주째 밀려있어요. 서둘러 확인해주세요!`,
          url: "/student/clinic",
        }
      : {
          title: "클리닉 점검표 안내",
          body: "지난주 클리닉 숙제·테스트가 아직 완료되지 않았어요. 확인해주세요!",
          url: "/student/clinic",
        }
  );

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
    )
  );

  const stale = results
    .map((r, i) => ({ r, endpoint: subs[i].endpoint }))
    .filter(({ r }) => {
      if (r.status !== "rejected") return false;
      const statusCode = (r.reason as { statusCode?: number } | undefined)?.statusCode;
      return statusCode === 404 || statusCode === 410;
    })
    .map(({ endpoint }) => endpoint);

  if (stale.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", stale);
  }
}
