"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { setZongjuApproval } from "@/lib/data";
import { maybeCreditZongjuApproval } from "@/lib/ujc";

export async function toggleZongjuApprovalAction(
  studentId: number,
  weekStartISO: string,
  approved: boolean
) {
  await requireZongjuSession();
  await setZongjuApproval(studentId, new Date(weekStartISO), approved);
  if (approved) {
    await maybeCreditZongjuApproval(studentId, new Date(weekStartISO));
  }
  revalidatePath(`/admin/students/approvals/${studentId}`);
  revalidatePath("/admin/students/approvals");
  revalidatePath("/admin");
  revalidatePath("/staff/clinic");
  revalidatePath("/student");
}
