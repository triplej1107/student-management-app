import type { ClassKey } from "./types";

interface ClassKeyInput {
  level: string | null;
  school: string | null;
  grade: string | null;
}

/**
 * Placeholder heuristic carried over from the design prototype — confirm the
 * real class-assignment rule with the academy. class_key is stored (not
 * derived) so 종주T can correct it per-student after import.
 */
export function classKeyFor(student: ClassKeyInput): ClassKey {
  if (student.level === "중등") return "예비고1";
  if (student.school === "가락고") return "가락고1";
  if (student.grade === "1") return "배명고1";
  return "배명고2";
}
