"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession } from "@/lib/authz";
import { setAttendance, setMakeup, clearMakeup } from "@/lib/data";
import type { AttendanceStatus } from "@/lib/types";

export async function markAttendanceAction(
  studentId: number,
  dateISO: string,
  status: AttendanceStatus
) {
  const session = await requireStaffSession();
  await setAttendance(studentId, new Date(dateISO), status, session.staffId);
  revalidatePath("/staff/attendance");
  revalidatePath("/staff");
}

export async function saveMakeupAction(
  studentId: number,
  dateISO: string,
  makeupDay: string,
  makeupTime: string
) {
  await requireStaffSession();
  await setMakeup(studentId, new Date(dateISO), makeupDay, makeupTime);
  revalidatePath("/staff/attendance");
  revalidatePath("/staff/clinic");
  revalidatePath("/staff");
}

export async function cancelMakeupAction(studentId: number, dateISO: string) {
  await requireStaffSession();
  await clearMakeup(studentId, new Date(dateISO));
  revalidatePath("/staff/attendance");
  revalidatePath("/staff/clinic");
}
