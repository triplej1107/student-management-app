"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { getClinicTemplate, upsertClinicTemplate } from "@/lib/data";
import type { ClassKey } from "@/lib/types";

export async function saveTemplateFieldAction(
  classKey: ClassKey,
  weekStartISO: string,
  field: "month" | "round" | { hw: number } | { test: number },
  value: string
) {
  await requireZongjuSession();
  const weekStart = new Date(weekStartISO);
  const existing = await getClinicTemplate(classKey, weekStart);
  const month = existing?.month ?? "";
  const round = existing?.round ?? "";
  const hwLabels = existing?.hw_labels ? [...existing.hw_labels] : ["", "", "", "", "", "", ""];
  const testLabels = existing?.test_labels ? [...existing.test_labels] : ["", "", "", ""];

  let nextMonth = month;
  let nextRound = round;
  if (field === "month") nextMonth = value;
  else if (field === "round") nextRound = value;
  else if (typeof field === "object" && "hw" in field) hwLabels[field.hw] = value;
  else if (typeof field === "object" && "test" in field) testLabels[field.test] = value;

  await upsertClinicTemplate(classKey, weekStart, {
    month: nextMonth,
    round: nextRound,
    hwLabels,
    testLabels,
  });
  revalidatePath("/admin/students/templates");
  revalidatePath("/staff/clinic");
  revalidatePath("/student/clinic");
  revalidatePath("/student");
}
