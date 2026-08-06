"use server";

import { revalidatePath } from "next/cache";
import { requireStaffOrZongjuSession } from "@/lib/authz";
import {
  createExamTimer,
  deleteExamTimer,
  pauseExamTimer,
  resumeExamTimer,
  updateExamTimer,
} from "@/lib/examTimers";
import { kstTimeToISO } from "@/lib/examTimerRules";
import { kstToday, toISODate } from "@/lib/weeks";

export interface TimerFormInput {
  studentName: string;
  examLabel: string;
  /** KST 벽시계 "HH:MM" */
  startTime: string;
  durationMinutes: number;
}

function parse(input: TimerFormInput) {
  const studentName = input.studentName.trim();
  if (!studentName) throw new Error("학생 이름을 입력해주세요.");

  const startAtISO = kstTimeToISO(toISODate(kstToday()), input.startTime);
  if (!startAtISO) throw new Error("시작 시간을 09:30처럼 입력해주세요.");

  const durationMinutes = Number(input.durationMinutes);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error("소요 시간을 분 단위 숫자로 입력해주세요.");
  }

  return {
    studentName,
    examLabel: input.examLabel.trim() || null,
    durationSeconds: Math.round(durationMinutes * 60),
    startAtISO,
  };
}

export async function createTimerAction(input: TimerFormInput) {
  await requireStaffOrZongjuSession();
  await createExamTimer(parse(input));
  revalidatePath("/staff");
}

export async function updateTimerAction(id: number, input: TimerFormInput) {
  await requireStaffOrZongjuSession();
  await updateExamTimer(id, parse(input));
  revalidatePath("/staff");
}

export async function pauseTimerAction(id: number) {
  await requireStaffOrZongjuSession();
  await pauseExamTimer(id);
  revalidatePath("/staff");
}

export async function resumeTimerAction(id: number) {
  await requireStaffOrZongjuSession();
  await resumeExamTimer(id);
  revalidatePath("/staff");
}

export async function deleteTimerAction(id: number) {
  await requireStaffOrZongjuSession();
  await deleteExamTimer(id);
  revalidatePath("/staff");
}
