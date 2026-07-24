"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { setZongjuApproval } from "@/lib/data";

export async function toggleZongjuApprovalAction(
  studentId: number,
  weekStartISO: string,
  approved: boolean
) {
  await requireZongjuSession();
  await setZongjuApproval(studentId, new Date(weekStartISO), approved);
  revalidatePath(`/admin/students/approvals/${studentId}`);
  revalidatePath("/admin/students/approvals");
  revalidatePath("/admin");
  revalidatePath("/staff/clinic");
}
