"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { setZongjuApproval, setZongjuFeedback } from "@/lib/data";
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

export async function saveZongjuFeedbackAction(studentId: number, weekStartISO: string, text: string) {
  await requireZongjuSession();
  await setZongjuFeedback(studentId, new Date(weekStartISO), text);
  revalidatePath(`/admin/students/approvals/${studentId}`);
  revalidatePath("/student");
  revalidatePath("/student/clinic");
}
