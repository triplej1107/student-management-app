"use server";

import { revalidatePath } from "next/cache";
import { requireStaffOrZongjuSession } from "@/lib/authz";
import { setAttendance, clearAttendance, setMakeup, clearMakeup, setParentTexted, getStudentById } from "@/lib/data";
import { getPushSubscriptionsForStudents, sendAttendancePush } from "@/lib/clinicPush";
import type { AttendanceStatus } from "@/lib/types";

function revalidateAttendancePaths() {
  revalidatePath("/staff/attendance");
  revalidatePath("/staff");
  revalidatePath("/admin/students/attendance");
  revalidatePath("/admin");
}

async function notifyAttendance(studentId: number, body: string) {
  const [student, subsMap] = await Promise.all([
    getStudentById(studentId),
    getPushSubscriptionsForStudents([studentId]),
  ]);
  if (!student) return;
  const subs = subsMap.get(studentId);
  if (subs && subs.length > 0) {
    await sendAttendancePush(subs, student.name, body);
  }
}

export async function markAttendanceAction(
  studentId: number,
  dateISO: string,
  status: AttendanceStatus
) {
  const session = await requireStaffOrZongjuSession();
  await setAttendance(studentId, new Date(dateISO), status, session.staffId ?? null);
  revalidateAttendancePaths();
  if (status === "출석" || status === "지각" || status === "결석") {
    await notifyAttendance(studentId, `오늘 ${status} 처리됐어요.`);
  }
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
  status: AttendanceStatus,
  note?: string
) {
  await requireStaffOrZongjuSession();
  await setMakeup(studentId, new Date(dateISO), makeupDay, makeupTime, note);
  revalidateAttendancePaths();
  revalidatePath("/staff/clinic");
  if (status === "조정") {
    // note(전달사항)는 조교들끼리만 보는 내용이라 학생·학부모 알림에는 안 담는다.
    await notifyAttendance(studentId, `오늘 수업이 조정됐어요 — 대체: ${makeupDay} ${makeupTime}`);
  }
}

export async function cancelMakeupAction(studentId: number, dateISO: string) {
  await requireStaffOrZongjuSession();
  await clearMakeup(studentId, new Date(dateISO));
  revalidateAttendancePaths();
  revalidatePath("/staff/clinic");
}

/** 2학기 전까지만 쓰는 임시 기능 — 학부모 문자 전송 체크. */
export async function toggleParentTextedAction(studentId: number, dateISO: string, texted: boolean) {
  await requireStaffOrZongjuSession();
  await setParentTexted(studentId, new Date(dateISO), texted);
  revalidateAttendancePaths();
}
