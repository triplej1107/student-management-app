"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { grantManualUjc, approveExchangeRequest, rejectExchangeRequest, getUjcBalance } from "@/lib/ujc";

export async function grantUjcAction(studentId: number, amount: number, note: string) {
  await requireZongjuSession();
  if (!Number.isFinite(amount) || amount === 0) throw new Error("올바른 개수를 입력해주세요.");
  await grantManualUjc(studentId, Math.trunc(amount), note);
  revalidatePath("/admin/ujc");
  revalidatePath("/student");
}

export async function approveExchangeAction(requestId: number) {
  const session = await requireZongjuSession();
  await approveExchangeRequest(requestId, session.staffId);
  revalidatePath("/admin/ujc");
  revalidatePath("/student");
}

export async function rejectExchangeAction(requestId: number) {
  const session = await requireZongjuSession();
  await rejectExchangeRequest(requestId, session.staffId);
  revalidatePath("/admin/ujc");
}

export async function getStudentUjcBalanceAction(studentId: number) {
  await requireZongjuSession();
  return getUjcBalance(studentId);
}
