"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { createCalendarNote, updateCalendarNote, deleteCalendarNote } from "@/lib/data";
import type { ClassKey } from "@/lib/types";

export async function addCalendarNoteAction(dateISO: string) {
  await requireZongjuSession();
  await createCalendarNote(new Date(dateISO), null);
  revalidatePath("/admin/students/calendar");
}

export async function updateCalendarNoteFieldAction(
  id: number,
  field: "class_key" | "content",
  value: string
) {
  await requireZongjuSession();
  const fields = field === "class_key" ? { class_key: (value || null) as ClassKey | null } : { content: value };
  await updateCalendarNote(id, fields);
  revalidatePath("/admin/students/calendar");
  revalidatePath("/student");
}

export async function updateCalendarNoteRangeAction(id: number, noteDate: string, endDate: string) {
  await requireZongjuSession();
  const clampedEnd = endDate < noteDate ? noteDate : endDate;
  await updateCalendarNote(id, { note_date: noteDate, end_date: clampedEnd });
  revalidatePath("/admin/students/calendar");
  revalidatePath("/student");
}

export async function deleteCalendarNoteAction(id: number) {
  await requireZongjuSession();
  await deleteCalendarNote(id);
  revalidatePath("/admin/students/calendar");
  revalidatePath("/student");
}
