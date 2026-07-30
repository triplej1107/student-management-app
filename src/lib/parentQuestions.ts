import "server-only";
import { supabase } from "./supabase";
import { classDayTimeTag } from "./weeks";
import type { ParentQuestion } from "./types";

/** 이번 질문 주(수요일 기준)에 해당 학생(학부모)이 남긴 질문 — 없으면
 * 아직 리셋 이후 질문을 남기지 않은 것. */
export async function getParentQuestion(
  studentId: number,
  weekStartISO: string
): Promise<ParentQuestion | null> {
  const { data } = await supabase
    .from("parent_questions")
    .select("*")
    .eq("student_id", studentId)
    .eq("week_start", weekStartISO)
    .maybeSingle();
  return (data as ParentQuestion) ?? null;
}

/** 학부모가 질문을 남기거나(최초) 아직 답변 전이면 내용을 수정한다. */
export async function upsertParentQuestion(studentId: number, weekStartISO: string, text: string) {
  await supabase
    .from("parent_questions")
    .upsert(
      { student_id: studentId, week_start: weekStartISO, question_text: text, updated_at: new Date().toISOString() },
      { onConflict: "student_id,week_start" }
    );
}

export interface ParentQuestionWithStudent extends ParentQuestion {
  studentName: string;
  classTag: string | null;
  schoolGrade: string | null;
}

/** 종주T 홈 화면 — 이번 질문 주의 모든 학부모 질문을 (미답변 먼저 ·
 * 오래된 순)으로 본다. */
export async function getParentQuestionsForWeek(weekStartISO: string): Promise<ParentQuestionWithStudent[]> {
  const { data } = await supabase
    .from("parent_questions")
    .select("*")
    .eq("week_start", weekStartISO)
    .order("created_at");
  const rows = (data as ParentQuestion[]) ?? [];
  if (rows.length === 0) return [];

  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const { data: studentRows } = await supabase
    .from("students")
    .select("id, name, class_day, class_time, school, grade")
    .in("id", studentIds);
  const studentsById = new Map(
    ((studentRows as { id: number; name: string; class_day: string | null; class_time: string | null; school: string | null; grade: string | null }[]) ?? []).map(
      (s) => [s.id, s]
    )
  );

  const mapped = rows.map((r) => {
    const s = studentsById.get(r.student_id);
    return {
      ...r,
      studentName: s?.name ?? "(알 수 없음)",
      classTag: classDayTimeTag(s?.class_day ?? null, s?.class_time ?? null),
      schoolGrade:
        s?.school || s?.grade ? [s?.school, s?.grade ? `${s.grade}학년` : null].filter(Boolean).join(" ") : null,
    };
  });

  return mapped.sort((a, b) => {
    const aAnswered = a.answer_text ? 1 : 0;
    const bAnswered = b.answer_text ? 1 : 0;
    if (aAnswered !== bAnswered) return aAnswered - bAnswered;
    return a.created_at < b.created_at ? -1 : 1;
  });
}

export async function answerParentQuestion(id: number, answerText: string) {
  await supabase
    .from("parent_questions")
    .update({ answer_text: answerText, answered_at: new Date().toISOString() })
    .eq("id", id);
}
