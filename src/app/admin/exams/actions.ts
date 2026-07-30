"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { upsertAnswerKey } from "@/lib/clinicOmr";
import { OMR_CHOICE_COUNT, type ClassKey } from "@/lib/types";

export async function saveAnswerKeyAction(
  classKey: ClassKey,
  weekStartISO: string,
  testIndex: number,
  rawAnswers: string,
  rawPoints: string
) {
  await requireZongjuSession();

  const digits = rawAnswers.replace(/[^0-9]/g, "").split("");
  if (digits.some((d) => Number(d) < 1 || Number(d) > OMR_CHOICE_COUNT)) {
    throw new Error(`정답은 1~${OMR_CHOICE_COUNT} 사이 숫자만 입력할 수 있어요.`);
  }

  const pointDigits = rawPoints.replace(/[^0-9]/g, "").split("").filter(Boolean);
  if (pointDigits.length > 0) {
    if (pointDigits.length !== digits.length) {
      throw new Error("배점은 입력하지 않거나, 정답 문항 수와 같은 자리수로 입력해주세요.");
    }
    if (pointDigits.some((d) => Number(d) < 1)) {
      throw new Error("배점은 1점 이상 숫자만 입력할 수 있어요.");
    }
  }
  const points = pointDigits.map(Number);

  await upsertAnswerKey(classKey, weekStartISO, testIndex, digits, points);
  revalidatePath("/admin/exams");
  revalidatePath("/student/omr");
}
