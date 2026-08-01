"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { createReminder, deleteReminder, updateReminder } from "@/lib/reminders";

function revalidateAll() {
  revalidatePath("/admin/staff/reminders");
  revalidatePath("/admin");
  revalidatePath("/staff");
  revalidatePath("/student");
}

export async function createReminderAction(
  eventDateISO: string,
  eventTime: string,
  content: string,
  studentId: number | null
) {
  await requireZongjuSession();
  if (!eventDateISO || !eventTime || !content.trim()) {
    throw new Error("날짜, 시간, 내용을 모두 입력해주세요.");
  }
  await createReminder(eventDateISO, eventTime, content.trim(), studentId);
  revalidateAll();
}

export async function updateReminderAction(
  id: number,
  eventDateISO: string,
  eventTime: string,
  content: string,
  studentId: number | null
) {
  await requireZongjuSession();
  if (!eventDateISO || !eventTime || !content.trim()) {
    throw new Error("날짜, 시간, 내용을 모두 입력해주세요.");
  }
  await updateReminder(id, {
    eventDateISO,
    eventTime,
    content: content.trim(),
    studentId,
  });
  revalidateAll();
}

export async function deleteReminderAction(id: number) {
  await requireZongjuSession();
  await deleteReminder(id);
  revalidateAll();
}
