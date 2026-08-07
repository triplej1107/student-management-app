import "server-only";
import { supabase } from "./supabase";
import { kstToday, toISODate } from "./weeks";
import {
  kstTimeToISO,
  normalizeStudentName,
  resumeStartAtISO,
  type TimerState,
} from "./examTimerRules";

export interface ExamTimer {
  id: number;
  student_name: string;
  exam_label: string | null;
  duration_seconds: number;
  start_at: string;
  paused_remaining_seconds: number | null;
}

const COLUMNS = "id, student_name, exam_label, duration_seconds, start_at, paused_remaining_seconds";

/**
 * 오늘 만든 타이머만 — 날이 바뀌면 판이 저절로 비워진다. 어제 것까지 계속
 * 쌓이면 조교가 매번 지워야 한다.
 */
export async function listTodayExamTimers(): Promise<ExamTimer[]> {
  const from = kstTimeToISO(toISODate(kstToday()), "00:00");
  const { data } = await supabase
    .from("exam_timers")
    .select(COLUMNS)
    .gte("created_at", from ?? new Date(0).toISOString())
    .order("created_at", { ascending: true });
  return (data as ExamTimer[]) ?? [];
}

/**
 * 그 학생 이름으로 오늘 올라온 타이머 — 학생 화면의 남은 시간 배너용.
 *
 * exam_timers는 학생 계정이 아니라 이름 글자만 들고 있어서(조교가 자동완성
 * 없이 직접 칠 수도 있다) 공백을 지운 이름으로 맞춘다. 동명이인이 있으면
 * 두 학생 모두에게 같은 배너가 뜨는데, 남은 시간을 보여주기만 할 뿐
 * 아무것도 제출하거나 바꾸지 않으므로 사고로 이어지지는 않는다.
 * 같은 이름이 여러 개면 가장 나중에 만든 것을 쓴다.
 *
 * 조회가 실패해도 절대 예외를 밖으로 던지지 않는다 — 이 함수는 학생 홈과
 * OMR마킹 화면에서 불린다. 타이머 하나 때문에 시험 화면이 안 열리면
 * 시험을 못 보는 사고가 난다. 실패하면 배너만 없이 화면이 그대로 뜬다.
 */
export async function getExamTimerForStudentName(name: string): Promise<ExamTimer | null> {
  try {
    const key = normalizeStudentName(name);
    if (!key) return null;
    const timers = await listTodayExamTimers();
    const hits = timers.filter((t) => normalizeStudentName(t.student_name) === key);
    return hits.length > 0 ? hits[hits.length - 1] : null;
  } catch (err) {
    console.error("[exam-timer] 학생 배너용 타이머 조회 실패 — 배너 없이 렌더", err);
    return null;
  }
}

export async function createExamTimer(input: {
  studentName: string;
  examLabel: string | null;
  durationSeconds: number;
  startAtISO: string;
}) {
  await supabase.from("exam_timers").insert({
    student_name: input.studentName,
    exam_label: input.examLabel,
    duration_seconds: input.durationSeconds,
    start_at: input.startAtISO,
    paused_remaining_seconds: null,
  });
}

async function getTimer(id: number): Promise<ExamTimer | null> {
  const { data } = await supabase.from("exam_timers").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as ExamTimer) ?? null;
}

function toState(t: ExamTimer): TimerState {
  return {
    startAtISO: t.start_at,
    durationSeconds: t.duration_seconds,
    pausedRemainingSeconds: t.paused_remaining_seconds,
  };
}

/** 정지 — 그 순간의 남은 시간을 박아둔다. */
export async function pauseExamTimer(id: number) {
  const t = await getTimer(id);
  if (!t || t.paused_remaining_seconds !== null) return;
  const remaining = t.duration_seconds - (Date.now() - Date.parse(t.start_at)) / 1000;
  await supabase
    .from("exam_timers")
    .update({
      paused_remaining_seconds: Math.max(0, Math.round(remaining)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

/** 시작/재개 — 멈춰 있던 남은 시간이 그대로 이어지도록 start_at을 다시 잡는다. */
export async function resumeExamTimer(id: number) {
  const t = await getTimer(id);
  if (!t || t.paused_remaining_seconds === null) return;
  await supabase
    .from("exam_timers")
    .update({
      start_at: resumeStartAtISO(toState(t), Date.now()),
      paused_remaining_seconds: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function updateExamTimer(
  id: number,
  fields: { studentName: string; examLabel: string | null; durationSeconds: number; startAtISO: string }
) {
  await supabase
    .from("exam_timers")
    .update({
      student_name: fields.studentName,
      exam_label: fields.examLabel,
      duration_seconds: fields.durationSeconds,
      start_at: fields.startAtISO,
      // 수정하면 진행 중 상태로 되돌린다 — 시작 시각을 새로 정한 셈이라
      // 멈춰뒀던 남은 시간은 더 이상 맞지 않는다.
      paused_remaining_seconds: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

export async function deleteExamTimer(id: number) {
  await supabase.from("exam_timers").delete().eq("id", id);
}
