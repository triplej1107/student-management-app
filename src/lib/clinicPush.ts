import "server-only";
import webpush from "web-push";
import { supabase } from "./supabase";
import { nowKST } from "./weeks";
import { isQuietHour } from "./quietHours";
import { isDeployedEnvironment } from "./env";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

/** 조용시간 — 밤 10시부터 아침 9시까지는 어떤 알림도 보내지 않는다.
 * 학생·학부모가 자는 시간에 폰이 울리면 안 되기 때문. 밤 10시 자동 결석
 * 알림만 "그날의 마지막 알림"으로 예외를 허용한다(allowInQuietHours) —
 * Vercel 크론이 22:00~22:59 사이 아무 때나 실행될 수 있어서 그 시각을
 * 조용시간에서 빼두면 그 한 시간이 통째로 열려버리기 때문이다. */
function isQuietHoursKST(): boolean {
  return isQuietHour(nowKST().getUTCHours());
}

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

/** 종주T는 staff/students 테이블에 자기 row가 없는 단일 관리자 로그인이라
 * is_zongju 플래그로 구독을 표시한다. */
export async function savePushSubscriptionForZongju(endpoint: string, p256dh: string, auth: string) {
  await supabase
    .from("push_subscriptions")
    .upsert({ is_zongju: true, endpoint, p256dh, auth }, { onConflict: "endpoint" });
}

export async function getPushSubscriptionsForZongju(): Promise<PushSubscriptionRow[]> {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("is_zongju", true);
  return (data as PushSubscriptionRow[]) ?? [];
}

/** "잊지마" 알림처럼 조교 전원에게 보내야 할 때 — 특정 staffId가 아니라
 * staff_id가 채워진 구독 전부를 가져온다. */
export async function getPushSubscriptionsForAllStaff(): Promise<PushSubscriptionRow[]> {
  const { data } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .not("staff_id", "is", null);
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

/** 공통 발송 로직 — 만료된 구독(410 Gone/404)은 조용히 지운다.
 * 모든 알림이 이 함수를 거치므로 조용시간 차단도 여기 한 곳에서 건다. */
async function sendPushToSubs(
  subs: PushSubscriptionRow[],
  payload: { title: string; body: string; url: string },
  opts?: { allowInQuietHours?: boolean }
) {
  if (!publicKey || !privateKey || subs.length === 0) return;
  if (isQuietHoursKST() && !opts?.allowInQuietHours) return;
  // 로컬에서 화면을 눌러보다가 실제 학생·조교 폰으로 알림이 나가는 사고를
  // 막는다. 로컬은 운영 DB를 그대로 보기 때문에 구독 정보도 진짜다.
  if (!isDeployedEnvironment()) {
    console.log(`[push:dry-run] ${payload.title} / ${payload.body} → ${subs.length}건`);
    return;
  }

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

/** 돌발퀘스트를 조교 기기에 바로 띄운다 — 앱을 안 보고 있어도 알게. */
export async function sendQuestPush(subs: PushSubscriptionRow[], content: string) {
  await sendPushToSubs(subs, {
    title: "⚡ 돌발퀘스트",
    body: content,
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
export async function sendAttendancePush(
  subs: PushSubscriptionRow[],
  studentName: string,
  body: string,
  opts?: { allowInQuietHours?: boolean }
) {
  await sendPushToSubs(
    subs,
    {
      title: `${studentName} 학생 출결 안내`,
      body,
      url: "/student",
    },
    opts
  );
}

/** 종주T 클리닉 최종결재가 완료되면 학생·학부모에게 보낸다. */
export async function sendClinicApprovedPush(subs: PushSubscriptionRow[], studentName: string) {
  await sendPushToSubs(subs, {
    title: "클리닉 점검표 결재 완료",
    body: `${studentName} 학생의 이번 주 클리닉 점검표가 최종 결재됐어요.`,
    url: "/student/clinic",
  });
}

/** "잊지마" 돌발 일정 알림(하루 전/1시간 전)을 조교·종주T에게 보낸다. */
export async function sendReminderPush(subs: PushSubscriptionRow[], body: string, url: string) {
  await sendPushToSubs(subs, { title: "🔔 잊지마", body, url });
}

/** 학부모가 질문을 남기면 종주T에게 보낸다. */
export async function sendParentQuestionPush(subs: PushSubscriptionRow[], studentName: string, questionText: string) {
  const preview = questionText.length > 40 ? `${questionText.slice(0, 40)}…` : questionText;
  await sendPushToSubs(subs, {
    title: "💬 학부모 질문 도착",
    body: `${studentName} 학생 학부모님: ${preview}`,
    url: "/admin",
  });
}
