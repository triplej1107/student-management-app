"use server";

import { revalidatePath } from "next/cache";
import { requireStaffOrZongjuSession } from "@/lib/authz";
import { setAttendance, clearAttendance, setMakeup, clearMakeup } from "@/lib/data";
import type { AttendanceStatus } from "@/lib/types";

function revalidateAttendancePaths() {
  revalidatePath("/staff/attendance");
  revalidatePath("/staff");
  revalidatePath("/admin/students/attendance");
  revalidatePath("/admin");
}

export async function markAttendanceAction(
  studentId: number,
  dateISO: string,
  status: AttendanceStatus
) {
  const session = await requireStaffOrZongjuSession();
  await setAttendance(studentId, new Date(dateISO), status, session.staffId ?? null);
  revalidateAttendancePaths();
}

export async function clearAttendanceAction(studentId: number, dateISO: string) {
  await requireStaffOrZongjuSession();
  await clearAttendance(studentId, new Date(dateISO));
  revalidateAttendancePaths();
}

export async function saveMakeupAction(
  studentId: number,
  dateISO: string,
  makeupDay: string,
  makeupTime: string,
  note?: string
) {
  await requireStaffOrZongjuSession();
  await setMakeup(studentId, new Date(dateISO), makeupDay, makeupTime, note);
  revalidateAttendancePaths();
  revalidatePath("/staff/clinic");
}

export async function cancelMakeupAction(studentId: number, dateISO: string) {
  await requireStaffOrZongjuSession();
  await clearMakeup(studentId, new Date(dateISO));
  revalidateAttendancePaths();
  revalidatePath("/staff/clinic");
}
