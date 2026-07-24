"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import {
  bulkImportStudents,
  bulkDeleteStudents,
  bulkSetClassKey,
  bulkSetEnrolled,
  type BulkImportResult,
} from "@/lib/data";
import { parseRosterPaste } from "@/lib/parseRoster";
import type { ClassKey } from "@/lib/types";

export async function bulkImportAction(text: string): Promise<BulkImportResult> {
  await requireZongjuSession();
  const rows = parseRosterPaste(text);
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, errors: [{ row: 0, message: "붙여넣은 내용이 없어요." }] };
  }
  const result = await bulkImportStudents(rows);
  revalidatePath("/admin/students/roster");
  revalidatePath("/admin/students/individual");
  return result;
}

export async function bulkDeleteAction(ids: number[]) {
  await requireZongjuSession();
  await bulkDeleteStudents(ids);
  revalidatePath("/admin/students/roster");
  revalidatePath("/admin/students/individual");
}

export async function bulkSetClassKeyAction(ids: number[], classKey: ClassKey) {
  await requireZongjuSession();
  await bulkSetClassKey(ids, classKey);
  revalidatePath("/admin/students/roster");
  revalidatePath("/admin/students/individual");
  revalidatePath("/staff");
  revalidatePath("/student");
}

export async function bulkSetEnrolledAction(ids: number[], enrolled: boolean) {
  await requireZongjuSession();
  await bulkSetEnrolled(ids, enrolled);
  revalidatePath("/admin/students/roster");
  revalidatePath("/admin/students/individual");
}
