"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { addDutySubstitute, removeDutySubstitute } from "@/lib/data";
import { answerParentQuestion } from "@/lib/parentQuestions";
import { parseISODate } from "@/lib/weeks";

export async function addDutySubstituteAction(dateISO: string, staffId: number) {
  await requireZongjuSession();
  await addDutySubstitute(parseISODate(dateISO), staffId);
  revalidatePath("/admin");
}

export async function removeDutySubstituteAction(dateISO: string, staffId: number) {
  await requireZongjuSession();
  await removeDutySubstitute(parseISODate(dateISO), staffId);
  revalidatePath("/admin");
}

export async function answerParentQuestionAction(id: number, answerText: string) {
  await requireZongjuSession();
  const trimmed = answerText.trim();
  if (!trimmed) return;
  await answerParentQuestion(id, trimmed);
  revalidatePath("/admin");
  revalidatePath("/student");
}
