import "server-only";
import { Resend } from "resend";

/** 서버에서 처리되지 않은 에러가 나면 원장님 이메일로 알려준다(월간
 * 보고서에 이미 쓰고 있는 Resend 계정 재사용) — Sentry 같은 무거운 도구
 * 없이 "적어도 조용히 묻히지는 않게" 하는 최소한의 안전장치.
 *
 * 같은 에러가 짧은 시간에 반복되면(예: 특정 페이지가 계속 터지는 경우)
 * 메일이 쏟아지지 않도록 같은 서버 인스턴스 안에서는 30분에 한 번만
 * 보낸다. 인스턴스가 재시작되면(배포, 콜드 스타트) 다시 보낼 수 있다 —
 * 완벽한 방지는 아니지만 가벼운 안전장치로는 충분하다. */
const THROTTLE_MS = 30 * 60 * 1000;
const lastSentAt = new Map<string, number>();

export async function notifyServerError(context: string, error: unknown) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_RECIPIENT_EMAIL;
  if (!apiKey || !to) return;

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  const key = `${context}::${message}`;
  const now = Date.now();
  const last = lastSentAt.get(key);
  if (last && now - last < THROTTLE_MS) return;
  lastSentAt.set(key, now);

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "유종의미 학생관리 <report@kaujm.kr>",
      to,
      subject: `[유종의미 앱 오류] ${context}`,
      text: `${context}에서 처리되지 않은 오류가 발생했어요.\n\n${message}\n\n${stack ?? ""}`,
    });
  } catch {
    // 에러 알림 자체가 실패해도 원래 요청 처리는 막지 않는다.
  }
}
