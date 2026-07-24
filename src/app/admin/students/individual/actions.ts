"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import {
  searchStudents,
  updateStudentAppFields,
  updateStudentOverrides,
  updateStudentRosterFields,
  getStudentById,
  createStudent,
  deleteStudent,
  type RosterFieldUpdate,
  type NewStudentInput,
} from "@/lib/data";
import { classKeyFor } from "@/lib/classKey";
import type { ClassKey, Student, StudentOverrides } from "@/lib/types";

export async function searchStudentsAction(query: {
  name?: string;
  school?: string;
  grade?: string;
}) {
  await requireZongjuSession();
  return searchStudents(query);
}

export async function updateIndividualOverrideAction(
  studentId: number,
  field: keyof StudentOverrides,
  value: string
) {
  await requireZongjuSession();
  const student = await getStudentById(studentId);
  const overrides = { ...(student?.overrides ?? {}) };
  const numeric = field !== "mock3Label";
  if (value.trim() === "") {
    delete overrides[field];
  } else {
    (overrides as Record<string, unknown>)[field] = numeric ? Number(value) : value;
  }
  await updateStudentOverrides(studentId, overrides);
  revalidatePath("/admin/students/individual");
  revalidatePath("/student");
}

export async function updateIndividualFieldAction(
  studentId: number,
  fields: Partial<{
    main_book: boolean;
    hw_book: boolean;
    mgmt_book: boolean;
    note_to_next_ta: string;
    class_key: ClassKey;
  }>
) {
  await requireZongjuSession();
  await updateStudentAppFields(studentId, fields);
  revalidatePath("/admin/students/individual");
  revalidatePath("/student");
  revalidatePath("/staff");
}

export async function updateRosterFieldAction(studentId: number, field: string, value: string) {
  await requireZongjuSession();
  const update: RosterFieldUpdate =
    field === "enrolled" ? { enrolled: value === "true" } : { [field]: value || null };
  await updateStudentRosterFields(studentId, update);
  revalidatePath("/admin/students/individual");
  revalidatePath("/student");
  revalidatePath("/staff");
}

export interface CreateStudentResult {
  ok: boolean;
  error?: string;
  student?: Student;
}

export type NewStudentFormInput = Omit<NewStudentInput, "class_key">;

export async function createStudentAction(
  input: NewStudentFormInput
): Promise<CreateStudentResult> {
  await requireZongjuSession();
  const code = input.student_code.trim();
  const trimmedName = input.name.trim();
  if (!code || !trimmedName) {
    return { ok: false, error: "학번과 이름을 입력해주세요." };
  }
  if (!/^\d{5}$/.test(code)) {
    return { ok: false, error: "학번은 5자리 숫자여야 해요." };
  }

  const payload: NewStudentInput = {
    ...input,
    student_code: code,
    name: trimmedName,
    class_key: classKeyFor({
      level: input.level ?? null,
      school: input.school ?? null,
      grade: input.grade ?? null,
    }),
  };

  try {
    const student = await createStudent(payload);
    revalidatePath("/admin/students/individual");
    revalidatePath("/admin/students/roster");
    return { ok: true, student };
  } catch {
    return { ok: false, error: "이미 사용 중인 학번이에요." };
  }
}

export async function deleteStudentAction(studentId: number) {
  await requireZongjuSession();
  await deleteStudent(studentId);
  revalidatePath("/admin/students/individual");
}
