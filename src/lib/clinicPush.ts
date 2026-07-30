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

export async function savePushSubscriptionForStaff(
  staffId: number,
  endpoint: string,
  p256dh: string,
  auth: string
) {
  await supabase
    .from("push_subscriptions")
    .upsert({ staff_id: staffId, endpoint, p256dh, auth }, { onConflict: "endpoint" });
}

export async function getPushSubscriptionsForStaff(staffId: number): Promise<PushSubscriptionRow[]> {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("staff_id", staffId);
  return (data as PushSubscriptionRow[]) ?? [];
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

/** 공통 발송 로직 — 만료된 구독(410 Gone/404)은 조용히 지운다. */
async function sendPushToSubs(
  subs: PushSubscriptionRow[],
  payload: { title: string; body: string; url: string }
) {
  if (!publicKey || !privateKey || subs.length === 0) return;

  const json = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, json)
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

/** 생일 축하 알림을 학생의 모든 구독 기기에 보낸다. */
export async function sendBirthdayPush(subs: PushSubscriptionRow[], studentName: string) {
  await sendPushToSubs(subs, {
    title: "🎂 생일 축하해요!",
    body: `종주T가 ${studentName}학생의 생일을 진심으로 축하합니다! UJC 하나를 선물로 줄게요!`,
    url: "/student",
  });
}

/** 종주T가 남긴 한마디를 조교의 모든 구독 기기에 보낸다. */
export async function sendStaffFeedbackPush(subs: PushSubscriptionRow[], message: string) {
  await sendPushToSubs(subs, {
    title: "종주T의 한마디",
    body: message,
    url: "/staff",
  });
}

/** 밀린 클리닉 알림을 학생의 모든 구독 기기에 보낸다. weeksOverdue가
 * 2 이상이면 더 강한 경고 문구를 쓴다. */
export async function sendClinicBacklogPush(subs: PushSubscriptionRow[], weeksOverdue: number) {
  await sendPushToSubs(
    subs,
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
}

/** 조교/종주T가 출결을 입력하면 학생·학부모(같은 studentId 아래 구독된
 * 모든 기기 — 학생 폰과 학부모 폰이 함께 걸린다)에게 보낸다. */
export async function sendAttendancePush(subs: PushSubscriptionRow[], studentName: string, body: string) {
  await sendPushToSubs(subs, {
    title: `${studentName} 학생 출결 안내`,
    body,
    url: "/student",
  });
}

/** 종주T 클리닉 최종결재가 완료되면 학생·학부모에게 보낸다. */
export async function sendClinicApprovedPush(subs: PushSubscriptionRow[], studentName: string) {
  await sendPushToSubs(subs, {
    title: "클리닉 점검표 결재 완료",
    body: `${studentName} 학생의 이번 주 클리닉 점검표가 최종 결재됐어요.`,
    url: "/student/clinic",
  });
}
