"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/authz";
import { getClinicCheck, setClinicHwCheck, setClinicTestScores, setStaffApproval } from "@/lib/data";
import type { TestScore } from "@/lib/types";

export async function toggleHwCheckAction(
  studentId: number,
  weekStartISO: string,
  index: number,
  checked: boolean
) {
  await requireStaffSession();
  const existing = await getClinicCheck(studentId, new Date(weekStartISO));
  const hwChecks = existing?.hw_checks ? [...existing.hw_checks] : [false, false, false, false, false, false, false];
  hwChecks[index] = checked;
  await setClinicHwCheck(studentId, new Date(weekStartISO), hwChecks);
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
  await requireStaffSession();
  const existing = await getClinicCheck(studentId, new Date(weekStartISO));
  const testScores: TestScore[] = existing?.test_scores
    ? [...existing.test_scores]
    : [{}, {}, {}, {}];
  while (testScores.length < 4) testScores.push({});
  testScores[index] = { ...testScores[index], [field]: value };
  await setClinicTestScores(studentId, new Date(weekStartISO), testScores);
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
