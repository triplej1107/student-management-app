"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession, requireStaffOrZongjuSession } from "@/lib/authz";
import {
  getClinicCheck,
  setClinicHwCheck,
  setClinicTestScores,
  setStaffApproval,
  setClinicFeedback,
} from "@/lib/data";
import { resetOmrSubmission } from "@/lib/clinicOmr";
import type { FeedbackTags, TestScore } from "@/lib/types";

// 숙제 체크/점수 입력은 조교뿐 아니라 종주T도 결재 화면에서 직접 한다.
export async function toggleHwCheckAction(
  studentId: number,
  weekStartISO: string,
  index: number,
  checked: boolean
) {
  await requireStaffOrZongjuSession();
  const existing = await getClinicCheck(studentId, new Date(weekStartISO));
  const hwChecks = existing?.hw_checks ? [...existing.hw_checks] : [false, false, false, false, false, false, false];
  hwChecks[index] = checked;
  await setClinicHwCheck(studentId, new Date(weekStartISO), hwChecks);
  revalidatePath(`/staff/clinic/${studentId}`);
  revalidatePath("/staff/clinic");
  revalidatePath(`/admin/students/approvals/${studentId}`);
  revalidatePath("/admin/students/approvals");
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
  await requireStaffOrZongjuSession();
  const existing = await getClinicCheck(studentId, new Date(weekStartISO));
  const testScores: TestScore[] = existing?.test_scores
    ? [...existing.test_scores]
    : [{}, {}, {}, {}];
  while (testScores.length < 4) testScores.push({});
  testScores[index] = { ...testScores[index], [field]: value };
  await setClinicTestScores(studentId, new Date(weekStartISO), testScores);
  revalidatePath(`/staff/clinic/${studentId}`);
  revalidatePath("/staff/clinic");
  revalidatePath(`/admin/students/approvals/${studentId}`);
  revalidatePath("/admin/students/approvals");
  revalidatePath("/student/clinic");
  revalidatePath("/student");
}

export async function resetOmrSubmissionAction(studentId: number, weekStartISO: string, testIndex: number) {
  await requireStaffSession();
  await resetOmrSubmission(studentId, weekStartISO, testIndex);
  revalidatePath(`/staff/clinic/${studentId}`);
  revalidatePath("/staff/clinic");
  revalidatePath("/admin/students/approvals");
  revalidatePath("/student/omr");
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
