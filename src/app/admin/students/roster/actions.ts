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
import { resetUjcBalance } from "@/lib/ujc";
import { parseRosterPaste } from "@/lib/parseRoster";
import { parseAcademyWorkbook } from "@/lib/parseAcademyWorkbook";
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

export interface AcademyImportResult extends BulkImportResult {
  noClassSchedule: string[];
}

/** 학원관리 프로그램에서 받은 "회원명단" 엑셀을 그대로 올려 학생 정보를
 * 갱신한다. 재원/퇴원과 반 배정은 건드리지 않고, 빈 칸은 기존 값을 유지한다
 * (parseAcademyWorkbook 주석 참고). */
export async function importAcademyWorkbookAction(formData: FormData): Promise<AcademyImportResult> {
  await requireZongjuSession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { inserted: 0, updated: 0, errors: [{ row: 0, message: "파일을 선택해주세요." }], noClassSchedule: [] };
  }

  const { rows, skipped, noClassSchedule } = await parseAcademyWorkbook(await file.arrayBuffer());
  if (rows.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      errors: skipped.length > 0 ? skipped : [{ row: 0, message: "읽어들일 학생이 없어요." }],
      noClassSchedule,
    };
  }

  const result = await bulkImportStudents(rows);
  revalidatePath("/admin/students/roster");
  revalidatePath("/admin/students/individual");
  revalidatePath("/admin/clinic-backlog");
  return { ...result, errors: [...skipped, ...result.errors], noClassSchedule };
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
  if (!enrolled) {
    await Promise.all(ids.map((id) => resetUjcBalance(id)));
  }
  revalidatePath("/admin/students/roster");
  revalidatePath("/admin/students/individual");
}
