import type { ClassKey } from "./types";

interface ClassKeyInput {
  level: string | null;
  school: string | null;
  grade: string | null;
}

/**
 * Default class guess for newly added students, matching the current
 * (방학) 3-반 structure. class_key is stored (not derived) so 종주T can
 * always correct it per-student. Update this alongside CLASSES in types.ts
 * when switching between 학기중/방학 class structures.
 */
export function classKeyFor(student: ClassKeyInput): ClassKey {
  if (student.level === "중등") return "예비고1";
  if (student.grade === "1") return "1학년정규";
  return "2학년정규";
}
