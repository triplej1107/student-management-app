"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { grantManualUjc, completeExchangeRequest, cancelExchangeRequest, getUjcBalance } from "@/lib/ujc";

export async function grantUjcAction(studentId: number, amount: number, note: string) {
  await requireZongjuSession();
  if (!Number.isFinite(amount) || amount === 0) throw new Error("올바른 개수를 입력해주세요.");
  await grantManualUjc(studentId, Math.trunc(amount), note);
  revalidatePath("/admin/ujc");
  revalidatePath("/student");
}

/** 카카오톡 선물 발송 완료 처리. */
export async function completeExchangeAction(requestId: number) {
  const session = await requireZongjuSession();
  await completeExchangeRequest(requestId, session.staffId);
  revalidatePath("/admin/ujc");
  revalidatePath("/student");
}

/** 신청 취소 — 이미 차감된 코인을 환불한다. */
export async function cancelExchangeAction(requestId: number) {
  const session = await requireZongjuSession();
  await cancelExchangeRequest(requestId, session.staffId);
  revalidatePath("/admin/ujc");
  revalidatePath("/student");
}

export async function getStudentUjcBalanceAction(studentId: number) {
  await requireZongjuSession();
  return getUjcBalance(studentId);
}
