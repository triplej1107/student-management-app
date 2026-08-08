"use server";

import { revalidatePath } from "next/cache";
import { requireStaffOrZongjuSession } from "@/lib/authz";
import {
  clearLectureOverride,
  setLectureAbsenceReason,
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

/**
 * 결석·지각 사유 적기.
 *
 * 출결 상태는 안 건드린다 — 사유를 적었다고 자동 동기화를 멈추면, 뒤늦게 온
 * 학생이 키오스크를 찍어도 결석으로 굳는다. 사유 칸만 사람 것이 우선이다.
 */
export async function saveLectureAbsenceReasonAction(
  studentId: number,
  dateISO: string,
  reason: string
) {
  await requireStaffOrZongjuSession();
  await setLectureAbsenceReason(studentId, dateISO, reason);
  revalidateLecturePaths();
}
