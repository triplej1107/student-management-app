"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { createDutyItem, updateDutyItem, deleteDutyItem } from "@/lib/data";

export async function addDutyItemAction() {
  await requireZongjuSession();
  await createDutyItem("");
  revalidatePath("/admin/staff/duty");
}

export async function updateDutyItemAction(id: number, label: string) {
  await requireZongjuSession();
  await updateDutyItem(id, label);
  revalidatePath("/admin/staff/duty");
  revalidatePath("/staff/checklist");
}

export async function deleteDutyItemAction(id: number) {
  await requireZongjuSession();
  await deleteDutyItem(id);
  revalidatePath("/admin/staff/duty");
  revalidatePath("/staff/checklist");
}
