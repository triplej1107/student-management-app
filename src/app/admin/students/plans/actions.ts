"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { upsertClassPlanField } from "@/lib/data";
import type { ClassKey } from "@/lib/types";

export async function saveClassPlanFieldAction(
  classKey: ClassKey,
  weekStartISO: string,
  field: "progress_content" | "clinic_content" | "homework_content",
  value: string
) {
  await requireZongjuSession();
  await upsertClassPlanField(classKey, new Date(weekStartISO), field, value);
  revalidatePath("/admin/students/plans");
  revalidatePath("/student/lesson");
}
