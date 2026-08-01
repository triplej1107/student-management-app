"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { setScholarshipCheck, type ScholarshipKind } from "@/lib/scholarships";

export async function setScholarshipCheckAction(
  kind: ScholarshipKind,
  refKey: string,
  field: "review_done" | "paid",
  value: boolean
) {
  await requireZongjuSession();
  await setScholarshipCheck(kind, refKey, field, value);
  revalidatePath("/admin/students/scholarships");
}
