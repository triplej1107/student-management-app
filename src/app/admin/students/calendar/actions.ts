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

export async function updateCalendarNoteContentAction(id: number, value: string) {
  await requireZongjuSession();
  await updateCalendarNote(id, { content: value });
  revalidatePath("/admin/students/calendar");
  revalidatePath("/student");
}

export async function updateCalendarNoteClassesAction(id: number, classKeys: ClassKey[]) {
  await requireZongjuSession();
  await updateCalendarNote(id, { class_keys: classKeys.length === 0 ? null : classKeys });
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
