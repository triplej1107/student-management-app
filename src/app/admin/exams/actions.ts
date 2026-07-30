"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { upsertAnswerKey } from "@/lib/clinicOmr";
import { OMR_CHOICE_COUNT, type ClassKey } from "@/lib/types";

export async function saveAnswerKeyAction(
  classKey: ClassKey,
  weekStartISO: string,
  testIndex: number,
  rawInput: string
) {
  await requireZongjuSession();

  const digits = rawInput.replace(/[^0-9]/g, "").split("");
  if (digits.some((d) => Number(d) < 1 || Number(d) > OMR_CHOICE_COUNT)) {
    throw new Error(`정답은 1~${OMR_CHOICE_COUNT} 사이 숫자만 입력할 수 있어요.`);
  }

  await upsertAnswerKey(classKey, weekStartISO, testIndex, digits);
  revalidatePath("/admin/exams");
  revalidatePath("/student/omr");
}
