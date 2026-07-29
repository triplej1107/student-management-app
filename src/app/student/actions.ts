"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { requestMarketExchange } from "@/lib/ujc";
import type { UjcExchangeAmount } from "@/lib/types";

export async function requestMarketExchangeAction(
  amount: UjcExchangeAmount,
  brandName: string,
  priceValue: number
) {
  const session = await getSession();
  if (session.role !== "student" || !session.studentId) {
    throw new Error("학생 계정만 교환 신청할 수 있어요.");
  }
  await requestMarketExchange(session.studentId, amount, brandName, priceValue);
  revalidatePath("/student");
  revalidatePath("/student/ujc-market");
}
