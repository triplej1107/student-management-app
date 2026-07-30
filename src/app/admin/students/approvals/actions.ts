"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { setZongjuApproval, setZongjuFeedback, getStudentById } from "@/lib/data";
import { maybeCreditZongjuApproval } from "@/lib/ujc";
import { getPushSubscriptionsForStudents, sendClinicApprovedPush } from "@/lib/clinicPush";

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

  if (approved) {
    const [student, subsMap] = await Promise.all([
      getStudentById(studentId),
      getPushSubscriptionsForStudents([studentId]),
    ]);
    const subs = subsMap.get(studentId);
    if (student && subs && subs.length > 0) {
      await sendClinicApprovedPush(subs, student.name);
    }
  }
}

export async function saveZongjuFeedbackAction(studentId: number, weekStartISO: string, text: string) {
  await requireZongjuSession();
  await setZongjuFeedback(studentId, new Date(weekStartISO), text);
  revalidatePath(`/admin/students/approvals/${studentId}`);
  revalidatePath("/student");
  revalidatePath("/student/clinic");
}
