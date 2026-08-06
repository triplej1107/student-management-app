import "server-only";
import { supabase } from "./supabase";
import { kstToday, toISODate } from "./weeks";
import { kstTimeToISO, resumeStartAtISO, type TimerState } from "./examTimerRules";

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
