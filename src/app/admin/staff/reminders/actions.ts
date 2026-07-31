"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { createReminder, deleteReminder } from "@/lib/reminders";

function revalidateAll() {
  revalidatePath("/admin/staff/reminders");
  revalidatePath("/admin");
  revalidatePath("/staff");
}

export async function createReminderAction(eventDateISO: string, eventTime: string, content: string) {
  await requireZongjuSession();
  if (!eventDateISO || !eventTime || !content.trim()) {
    throw new Error("요일, 시간, 내용을 모두 입력해주세요.");
  }
  await createReminder(eventDateISO, eventTime, content.trim());
  revalidateAll();
}

export async function deleteReminderAction(id: number) {
  await requireZongjuSession();
  await deleteReminder(id);
  revalidateAll();
}
