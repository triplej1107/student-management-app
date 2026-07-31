import type { Instrumentation } from "next";

/** Next.js가 서버 에러(RSC 렌더링/라우트 핸들러/서버 액션)를 잡을 때마다
 * 호출해주는 전역 훅 — 여기서 원장님께 이메일로 알려준다(errorNotify.ts).
 * Edge 런타임에서는 Resend(Node 전용) 호출이 불가능해 건너뛴다. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { notifyServerError } = await import("./lib/errorNotify");
  await notifyServerError(`${context.routeType} · ${request.path}`, err);
};
