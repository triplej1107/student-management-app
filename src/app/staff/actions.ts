"use server";

import { requireStaffSession } from "@/lib/authz";
import { markStaffFeedbackSeen } from "@/lib/staffFeedback";

export async function markStaffFeedbackSeenAction(ids: number[]) {
  await requireStaffSession();
  await markStaffFeedbackSeen(ids);
}
