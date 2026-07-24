"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/authz";
import { toggleDutyCheck } from "@/lib/data";

export async function toggleDutyCheckAction(itemId: number, dateISO: string, checked: boolean) {
  const session = await requireStaffSession();
  await toggleDutyCheck(session.staffId, itemId, new Date(dateISO), checked);
  revalidatePath("/staff/checklist");
  revalidatePath("/staff");
}
