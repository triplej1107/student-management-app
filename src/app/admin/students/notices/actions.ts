"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { createNotice, updateNotice, deleteNotice } from "@/lib/data";
import type { ClassKey, Notice } from "@/lib/types";

export async function addNoticeAction(classKey: ClassKey) {
  await requireZongjuSession();
  await createNotice(classKey);
  revalidatePath("/admin/students/notices");
}

export async function updateNoticeFieldAction(
  id: number,
  field: keyof Pick<Notice, "title" | "notice_date" | "tag" | "content">,
  value: string
) {
  await requireZongjuSession();
  await updateNotice(id, { [field]: value });
  revalidatePath("/admin/students/notices");
  revalidatePath("/student/notices");
  revalidatePath("/student");
  revalidatePath("/staff");
}

export async function deleteNoticeAction(id: number) {
  await requireZongjuSession();
  await deleteNotice(id);
  revalidatePath("/admin/students/notices");
  revalidatePath("/student/notices");
  revalidatePath("/student");
}
