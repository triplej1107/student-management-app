"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { requestExchange, type ExchangeAmount } from "@/lib/ujc";

export async function requestExchangeAction(amount: ExchangeAmount) {
  const session = await getSession();
  if (session.role !== "student" || !session.studentId) {
    throw new Error("학생 계정만 교환 신청할 수 있어요.");
  }
  await requestExchange(session.studentId, amount);
  revalidatePath("/student");
}
