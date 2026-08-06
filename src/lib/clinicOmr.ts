import "server-only";
import { supabase } from "./supabase";
import { getClinicCheck, setClinicTestScores, listStudentsByClass } from "./data";
import { parseISODate } from "./weeks";
import { wrongAnswers, type WrongAnswer } from "./omrReview";
import type { ClassKey, ClinicAnswerKey, ClinicOmrSubmission, TestScore } from "./types";

export async function getAnswerKey(
  classKey: ClassKey,
  weekStartISO: string,
  testIndex: number
): Promise<ClinicAnswerKey | null> {
  const { data } = await supabase
    .from("clinic_answer_keys")
    .select("*")
    .eq("class_key", classKey)
    .eq("week_start", weekStartISO)
    .eq("test_index", testIndex)
    .eq("round", 1)
    .maybeSingle();
  return (data as ClinicAnswerKey) ?? null;
}

/** 시험 관리 화면에서 4칸을 한 번에 보여주기 위해 test_index로 매핑해 반환. */
export async function getAnswerKeysForClassWeek(
  classKey: ClassKey,
  weekStartISO: string
): Promise<Map<number, ClinicAnswerKey>> {
  const { data } = await supabase
    .from("clinic_answer_keys")
    .select("*")
    .eq("class_key", classKey)
    .eq("week_start", weekStartISO)
    .eq("round", 1);
  const map = new Map<number, ClinicAnswerKey>();
  for (const row of (data as ClinicAnswerKey[]) ?? []) {
    map.set(row.test_index, row);
  }
  return map;
}

export async function upsertAnswerKey(
  classKey: ClassKey,
  weekStartISO: string,
  testIndex: number,
  answers: string[],
  points: number[]
) {
  await supabase.from("clinic_answer_keys").upsert(
    {
      class_key: classKey,
      week_start: weekStartISO,
      test_index: testIndex,
      round: 1,
      answers,
      points,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "class_key,week_start,test_index,round" }
  );
}

/** points가 비어있거나 answers와 길이가 다르면(=모의고사식 배점을 안 썼으면)
 * 문항당 1점으로 취급 — 내신 클리닉테스트의 "맞힌 문항 수" 채점과 동일해진다. */
export function questionWeights(key: Pick<ClinicAnswerKey, "answers" | "points">): number[] {
  if (key.points.length === key.answers.length) return key.points;
  return key.answers.map(() => 1);
}

/** 문항별 배점이 전부 1점이면(=모의고사식 배점을 안 쓴 내신 방식이면) true. */
export function isWeightedKey(key: Pick<ClinicAnswerKey, "answers" | "points">): boolean {
  return questionWeights(key).some((w) => w !== 1);
}

export async function getOmrSubmission(
  studentId: number,
  weekStartISO: string,
  testIndex: number
): Promise<ClinicOmrSubmission | null> {
  const { data } = await supabase
    .from("clinic_omr_submissions")
    .select("*")
    .eq("student_id", studentId)
    .eq("week_start", weekStartISO)
    .eq("test_index", testIndex)
    .eq("round", 1)
    .maybeSingle();
  return (data as ClinicOmrSubmission) ?? null;
}

/** 조교/종주T 점검표 화면에서 4칸을 한 번에 보여주기 위해 test_index로 매핑해 반환. */
export async function getOmrSubmissionsForStudentWeek(
  studentId: number,
  weekStartISO: string
): Promise<Map<number, ClinicOmrSubmission>> {
  const { data } = await supabase
    .from("clinic_omr_submissions")
    .select("*")
    .eq("student_id", studentId)
    .eq("week_start", weekStartISO)
    .eq("round", 1);
  const map = new Map<number, ClinicOmrSubmission>();
  for (const row of (data as ClinicOmrSubmission[]) ?? []) {
    map.set(row.test_index, row);
  }
  return map;
}

/** 학생이 OMR마킹을 실수로 이탈했거나 다시 응시해야 할 때, 조교·종주T가
 * 제출 기록과 그 점수를 지워 다시 응시할 수 있게 한다. */
export async function resetOmrSubmission(studentId: number, weekStartISO: string, testIndex: number) {
  await supabase
    .from("clinic_omr_submissions")
    .delete()
    .eq("student_id", studentId)
    .eq("week_start", weekStartISO)
    .eq("test_index", testIndex)
    .eq("round", 1);

  const weekStart = parseISODate(weekStartISO);
  const existing = await getClinicCheck(studentId, weekStart);
  const testScores: TestScore[] = existing?.test_scores ? [...existing.test_scores] : [{}, {}, {}, {}];
  while (testScores.length < 4) testScores.push({});
  testScores[testIndex] = {};
  await setClinicTestScores(studentId, weekStart, testScores);
}

/** 정답키와 비교해 채점하고, 제출 기록을 남긴 뒤 기존 clinic_checks.test_scores에도
 * 그대로 반영한다 — 이 덕분에 testProgressLabel/isClinicFullyDone/ujcTier/
 * monthlyReport/밀림 관리 등 test_scores를 읽는 모든 곳이 수정 없이 그대로 동작한다. */
export async function submitOmr(
  studentId: number,
  classKey: ClassKey,
  weekStartISO: string,
  testIndex: number,
  answers: string[],
  leftApp = false
): Promise<{ score: number; total: number; wrong: WrongAnswer[] }> {
  const key = await getAnswerKey(classKey, weekStartISO, testIndex);
  if (!key) throw new Error("아직 정답이 등록되지 않았어요.");
  if (answers.length !== key.answers.length) {
    throw new Error("답안 문항 수가 일치하지 않아요.");
  }

  const weights = questionWeights(key);
  const score = answers.reduce((sum, a, i) => sum + (a === key.answers[i] ? weights[i] : 0), 0);
  const total = weights.reduce((sum, w) => sum + w, 0);

  await supabase.from("clinic_omr_submissions").upsert(
    {
      student_id: studentId,
      week_start: weekStartISO,
      test_index: testIndex,
      round: 1,
      answers,
      score,
      total,
      left_app: leftApp,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "student_id,week_start,test_index,round" }
  );

  const weekStart = parseISODate(weekStartISO);
  const existing = await getClinicCheck(studentId, weekStart);
  const testScores: TestScore[] = existing?.test_scores ? [...existing.test_scores] : [{}, {}, {}, {}];
  while (testScores.length < 4) testScores.push({});
  testScores[testIndex] = { score: String(score), total: String(total) };
  await setClinicTestScores(studentId, weekStart, testScores);

  return { score, total, wrong: wrongAnswers(key.answers, answers) };
}

export interface QuestionAnalysis {
  questionIndex: number; // 0-based
  correctAnswer: string;
  submissionCount: number;
  wrongCount: number;
  wrongRate: number; // 0~100, 소수 1자리
  topWrongAnswer: string | null; // "매력적인 오답" — 오답 중 가장 많이 고른 선택지(없으면 null)
  topWrongCount: number;
}

/** 이 반·주차·테스트를 제출한 학생들의 마킹을 문항별로 집계해 "오답률"과
 * "매력적인 오답"(오답 중 가장 많이 고른 선택지)을 계산하고, 오답률이 높은
 * 순으로 5문항만 반환한다. 정답키가 없거나 제출자가 없으면 빈 배열. */
export async function getOmrQuestionAnalysis(
  classKey: ClassKey,
  weekStartISO: string,
  testIndex: number
): Promise<QuestionAnalysis[]> {
  const key = await getAnswerKey(classKey, weekStartISO, testIndex);
  if (!key || key.answers.length === 0) return [];

  const students = await listStudentsByClass(classKey);
  if (students.length === 0) return [];

  const { data } = await supabase
    .from("clinic_omr_submissions")
    .select("answers")
    .in(
      "student_id",
      students.map((s) => s.id)
    )
    .eq("week_start", weekStartISO)
    .eq("test_index", testIndex)
    .eq("round", 1);

  const submissions = (data as { answers: string[] }[]) ?? [];
  if (submissions.length === 0) return [];

  const analysis: QuestionAnalysis[] = key.answers.map((correctAnswer, qi) => {
    let wrongCount = 0;
    const wrongTally = new Map<string, number>();
    for (const sub of submissions) {
      const picked = sub.answers[qi];
      if (!picked || picked === correctAnswer) continue;
      wrongCount++;
      wrongTally.set(picked, (wrongTally.get(picked) ?? 0) + 1);
    }
    let topWrongAnswer: string | null = null;
    let topWrongCount = 0;
    for (const [answer, count] of wrongTally) {
      if (count > topWrongCount) {
        topWrongAnswer = answer;
        topWrongCount = count;
      }
    }
    return {
      questionIndex: qi,
      correctAnswer,
      submissionCount: submissions.length,
      wrongCount,
      wrongRate: Math.round((wrongCount / submissions.length) * 1000) / 10,
      topWrongAnswer,
      topWrongCount,
    };
  });

  return analysis.sort((a, b) => b.wrongRate - a.wrongRate).slice(0, 5);
}
