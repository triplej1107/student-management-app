"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { requestMarketExchange } from "@/lib/ujc";
import { upsertParentQuestion } from "@/lib/parentQuestions";
import { submitOmr } from "@/lib/clinicOmr";
import { getStudentById } from "@/lib/data";
import { getPushSubscriptionsForZongju, sendParentQuestionPush } from "@/lib/clinicPush";
import { getToday } from "@/lib/today";
import { toISODate } from "@/lib/weeks";
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

export async function submitParentQuestionAction(text: string) {
  const session = await getSession();
  if (session.role !== "parent" || !session.studentId) {
    throw new Error("학부모 계정만 질문을 남길 수 있어요.");
  }
  const trimmed = text.trim();
  if (!trimmed) return;

  const weekStartISO = toISODate(getToday().questionWeekStart);
  await upsertParentQuestion(session.studentId, weekStartISO, trimmed);

  const subs = await getPushSubscriptionsForZongju();
  if (subs.length > 0) {
    const student = await getStudentById(session.studentId);
    await sendParentQuestionPush(subs, student?.name ?? "학생", trimmed);
  }

  revalidatePath("/student");
  revalidatePath("/admin");
}

export async function submitOmrAction(testIndex: number, answers: string[], leftApp = false) {
  const session = await getSession();
  if (session.role !== "student" || !session.studentId) {
    throw new Error("학생 계정만 OMR을 제출할 수 있어요.");
  }
  const student = await getStudentById(session.studentId);
  if (!student?.class_key) {
    throw new Error("반 배정 정보가 없어요.");
  }

  const weekStartISO = toISODate(getToday().clinicWeekStart);
  const result = await submitOmr(session.studentId, student.class_key, weekStartISO, testIndex, answers, leftApp);

  revalidatePath("/student/omr");
  revalidatePath("/student/clinic");
  revalidatePath("/student");
  revalidatePath("/staff/clinic");
  revalidatePath("/admin/students/approvals");

  return result;
}
