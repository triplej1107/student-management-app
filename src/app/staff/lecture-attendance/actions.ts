"use server";

import { revalidatePath } from "next/cache";
import { requireStaffOrZongjuSession } from "@/lib/authz";
import {
  clearLectureOverride,
  setLectureAttendanceManually,
  setLectureOverride,
} from "@/lib/lectureAttendance";
import type { LectureStatus } from "@/lib/lectureRules";

function revalidateLecturePaths() {
  revalidatePath("/staff/lecture-attendance");
  revalidatePath("/admin/students/lecture-attendance");
  revalidatePath("/staff");
}

/** 조교·종주T 둘 다 쓸 수 있다 — 조교가 체크하고 종주T가 확인·수정하는 흐름. */
export async function markLectureAttendanceAction(
  studentId: number,
  dateISO: string,
  status: LectureStatus
) {
  await requireStaffOrZongjuSession();
  await setLectureAttendanceManually(studentId, dateISO, status);
  revalidateLecturePaths();
}

export async function saveLectureMakeupAction(
  studentId: number,
  dateISO: string,
  movedDay: string,
  movedTime: string,
  note?: string
) {
  await requireStaffOrZongjuSession();
  await setLectureOverride(studentId, dateISO, movedDay, movedTime, note);
  revalidateLecturePaths();
}

export async function cancelLectureMakeupAction(studentId: number, dateISO: string) {
  await requireStaffOrZongjuSession();
  await clearLectureOverride(studentId, dateISO);
  revalidateLecturePaths();
}
