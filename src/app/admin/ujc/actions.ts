"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { grantManualUjc, completeExchangeRequest, cancelExchangeRequest, getUjcBalance } from "@/lib/ujc";
import { createUjcMarketItem, updateUjcMarketItem, deleteUjcMarketItem } from "@/lib/ujcMarket";
import type { UjcExchangeAmount, UjcMarketBrand } from "@/lib/types";

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

export async function createUjcMarketItemAction(
  tier: UjcExchangeAmount,
  brand: UjcMarketBrand,
  brandLabel: string,
  priceValue: number
) {
  await requireZongjuSession();
  if (!Number.isFinite(priceValue) || priceValue <= 0) throw new Error("올바른 금액을 입력해주세요.");
  await createUjcMarketItem(tier, brand, brandLabel, Math.trunc(priceValue));
  revalidatePath("/admin/ujc");
  revalidatePath("/student/ujc-market");
}

export async function updateUjcMarketItemAction(
  id: number,
  fields: Partial<{ tier: UjcExchangeAmount; brand: UjcMarketBrand; brandLabel: string; priceValue: number; active: boolean }>
) {
  await requireZongjuSession();
  await updateUjcMarketItem(id, fields);
  revalidatePath("/admin/ujc");
  revalidatePath("/student/ujc-market");
}

export async function deleteUjcMarketItemAction(id: number) {
  await requireZongjuSession();
  await deleteUjcMarketItem(id);
  revalidatePath("/admin/ujc");
  revalidatePath("/student/ujc-market");
}
