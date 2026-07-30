"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { addDutySubstitute, removeDutySubstitute } from "@/lib/data";
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
