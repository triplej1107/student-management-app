"use server";

import { revalidatePath } from "next/cache";
import { requireStaffOrZongjuSession } from "@/lib/authz";
import {
  createExamTimer,
  deleteExamTimer,
  pauseExamTimer,
  resolveStudentIdByName,
  resumeExamTimer,
  updateExamTimer,
} from "@/lib/examTimers";
import { kstTimeToISO } from "@/lib/examTimerRules";
import { kstToday, toISODate } from "@/lib/weeks";

export interface TimerFormInput {
  studentName: string;
  /** 자동완성 목록에서 고른 학생. 손으로 친 이름이면 null이고, 그때는
   * 서버가 이름으로 한 번 더 찾아본다(resolveTimerStudentId). */
  studentId: number | null;
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

/**
 * 타이머에 붙일 학생 계정 — 목록에서 고른 게 있으면 그걸 쓰고, 손으로 친
 * 이름이면 서버가 명단에서 한 번 더 찾아본다. 조교가 자동완성을 안 쓰고
 * 그냥 타이핑해도 학생 화면에 남은 시간이 뜨게 하려는 것. 동명이인이라
 * 누구인지 못 정하면 null로 두고 이름 대조로 넘긴다.
 */
async function resolveTimerStudentId(input: TimerFormInput): Promise<number | null> {
  if (input.studentId) return input.studentId;
  return resolveStudentIdByName(input.studentName);
}

export async function createTimerAction(input: TimerFormInput) {
  await requireStaffOrZongjuSession();
  await createExamTimer({ ...parse(input), studentId: await resolveTimerStudentId(input) });
  revalidatePath("/staff");
}

export async function updateTimerAction(id: number, input: TimerFormInput) {
  await requireStaffOrZongjuSession();
  await updateExamTimer(id, { ...parse(input), studentId: await resolveTimerStudentId(input) });
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
