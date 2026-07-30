"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { sendStaffFeedback } from "@/lib/staffFeedback";
import { getPushSubscriptionsForStaff, sendStaffFeedbackPush } from "@/lib/clinicPush";

export async function sendStaffFeedbackAction(staffId: number, message: string) {
  await requireZongjuSession();
  const trimmed = message.trim();
  if (!trimmed) return;

  await sendStaffFeedback(staffId, trimmed);
  const subs = await getPushSubscriptionsForStaff(staffId);
  if (subs.length > 0) {
    await sendStaffFeedbackPush(subs, trimmed);
  }

  revalidatePath("/admin/staff/feedback");
  revalidatePath("/staff");
}
