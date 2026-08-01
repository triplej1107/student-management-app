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
  getSchoolExams,
  upsertSchoolExam,
  getMockExams,
  upsertMockExam,
  type RosterFieldUpdate,
  type NewStudentInput,
} from "@/lib/data";
import { resetUjcBalance } from "@/lib/ujc";
import { getStudentGradeTrends, type StudentGradeTrends } from "@/lib/gradeTrends";
import { classKeyFor } from "@/lib/classKey";
import type { ClassKey, MockExam, SchoolExam, Student, StudentOverrides } from "@/lib/types";

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
  if (field === "enrolled" && value === "false") {
    await resetUjcBalance(studentId);
  }
  revalidatePath("/admin/students/individual");
  // 첫수업일·소개 메모·재원 여부가 바뀌면 장학금 대상 판정이 통째로 달라진다.
  revalidatePath("/admin/students/scholarships");
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

export async function getSchoolExamsAction(studentId: number): Promise<Record<string, SchoolExam>> {
  await requireZongjuSession();
  return Object.fromEntries(await getSchoolExams(studentId));
}

export async function upsertSchoolExamAction(
  studentId: number,
  examKey: string,
  fields: Partial<Pick<SchoolExam, "score" | "rank" | "grade" | "note">>
) {
  await requireZongjuSession();
  await upsertSchoolExam(studentId, examKey, fields);
  revalidatePath("/admin/students/individual");
  revalidatePath("/student");
}

export async function getMockExamsAction(studentId: number): Promise<Record<string, MockExam>> {
  await requireZongjuSession();
  return Object.fromEntries(await getMockExams(studentId));
}

export async function upsertMockExamAction(
  studentId: number,
  examKey: string,
  fields: Partial<Pick<MockExam, "score" | "percentile" | "grade" | "note">>
) {
  await requireZongjuSession();
  await upsertMockExam(studentId, examKey, fields);
  revalidatePath("/admin/students/individual");
  revalidatePath("/student");
}

/** 개별 관리 화면 맨 아래에 학생 성적 그래프를 보여주기 위한 조회 —
 * 학생 본인 화면과 같은 계산(lib/gradeTrends)을 그대로 쓴다. */
export async function getStudentGradeTrendsAction(studentId: number): Promise<StudentGradeTrends> {
  await requireZongjuSession();
  return getStudentGradeTrends(studentId);
}
