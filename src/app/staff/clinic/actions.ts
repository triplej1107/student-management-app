"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/authz";
import {
  getClinicCheck,
  setClinicHwCheck,
  setClinicTestScores,
  setStaffApproval,
  setClinicFeedback,
} from "@/lib/data";
import { maybeCreditClinicCompletion } from "@/lib/ujc";
import type { FeedbackTags, TestScore } from "@/lib/types";

export async function toggleHwCheckAction(
  studentId: number,
  weekStartISO: string,
  index: number,
  checked: boolean
) {
  const session = await requireStaffSession();
  const existing = await getClinicCheck(studentId, new Date(weekStartISO));
  const hwChecks = existing?.hw_checks ? [...existing.hw_checks] : [false, false, false, false, false, false, false];
  hwChecks[index] = checked;
  await setClinicHwCheck(studentId, new Date(weekStartISO), hwChecks);
  await maybeCreditClinicCompletion(studentId, new Date(weekStartISO), session.staffId);
  revalidatePath(`/staff/clinic/${studentId}`);
  revalidatePath("/staff/clinic");
  revalidatePath("/student/clinic");
  revalidatePath("/student");
}

export async function updateTestScoreAction(
  studentId: number,
  weekStartISO: string,
  index: number,
  field: "score" | "total",
  value: string
) {
  const session = await requireStaffSession();
  const existing = await getClinicCheck(studentId, new Date(weekStartISO));
  const testScores: TestScore[] = existing?.test_scores
    ? [...existing.test_scores]
    : [{}, {}, {}, {}];
  while (testScores.length < 4) testScores.push({});
  testScores[index] = { ...testScores[index], [field]: value };
  await setClinicTestScores(studentId, new Date(weekStartISO), testScores);
  await maybeCreditClinicCompletion(studentId, new Date(weekStartISO), session.staffId);
  revalidatePath(`/staff/clinic/${studentId}`);
  revalidatePath("/staff/clinic");
  revalidatePath("/student/clinic");
  revalidatePath("/student");
}

export async function toggleStaffApprovalAction(
  studentId: number,
  weekStartISO: string,
  approved: boolean
) {
  const session = await requireStaffSession();
  await setStaffApproval(studentId, new Date(weekStartISO), approved, session.staffId);
  revalidatePath(`/staff/clinic/${studentId}`);
  revalidatePath("/staff/clinic");
  revalidatePath("/admin/students/approvals");
}

export async function saveFeedbackTagsAction(
  studentId: number,
  weekStartISO: string,
  tags: FeedbackTags
) {
  await requireStaffSession();
  await setClinicFeedback(studentId, new Date(weekStartISO), { feedback_tags: tags });
  revalidatePath(`/staff/clinic/${studentId}`);
}

export async function saveFeedbackTextAction(
  studentId: number,
  weekStartISO: string,
  text: string
) {
  await requireStaffSession();
  await setClinicFeedback(studentId, new Date(weekStartISO), { feedback_text: text });
  revalidatePath(`/staff/clinic/${studentId}`);
  revalidatePath("/student/clinic");
  revalidatePath("/student");
  revalidatePath("/admin/students/approvals");
}
