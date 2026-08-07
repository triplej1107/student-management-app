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
  /** 붙잡아둔 학생 계정. 조교가 명단에 없는 이름을 그냥 쳤으면 null이고,
   * 그때는 이름 글자로 맞춘다(getExamTimerForStudent 참고). */
  student_id: number | null;
  exam_label: string | null;
  duration_seconds: number;
  start_at: string;
  paused_remaining_seconds: number | null;
}

const COLUMNS =
  "id, student_name, student_id, exam_label, duration_seconds, start_at, paused_remaining_seconds";

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
 * 오늘 올라온 그 학생의 타이머 — 학생 화면의 남은 시간 배너용.
 *
 * student_id가 붙어 있으면 그걸로 정확히 찾는다. 조교가 명단에 없는 이름을
 * 그냥 쳐서 id가 안 붙은 타이머만 예전처럼 이름(공백 제거)으로 맞춘다.
 * **id가 붙은 타이머는 이름으로 다시 걸리지 않게** 걸러낸다 — 안 그러면
 * 동명이인 A에게 붙여둔 타이머가 B 화면에도 뜬다.
 * 후보가 여럿이면 가장 나중에 만든 것을 쓴다.
 *
 * 조회가 실패해도 절대 예외를 밖으로 던지지 않는다 — 이 함수는 학생 홈과
 * OMR마킹 화면에서 불린다. 타이머 하나 때문에 시험 화면이 안 열리면
 * 시험을 못 보는 사고가 난다. 실패하면 배너만 없이 화면이 그대로 뜬다.
 */
export async function getExamTimerForStudent(
  studentId: number,
  name: string
): Promise<ExamTimer | null> {
  try {
    const timers = await listTodayExamTimers();

    const byId = timers.filter((t) => t.student_id === studentId);
    if (byId.length > 0) return byId[byId.length - 1];

    const key = normalizeStudentName(name);
    if (!key) return null;
    const byName = timers.filter(
      (t) => t.student_id === null && normalizeStudentName(t.student_name) === key
    );
    return byName.length > 0 ? byName[byName.length - 1] : null;
  } catch (err) {
    console.error("[exam-timer] 학생 배너용 타이머 조회 실패 — 배너 없이 렌더", err);
    return null;
  }
}

/**
 * 조교가 친 이름으로 학생 계정을 찾아준다 — 자동완성 목록에서 안 고르고
 * 손으로 쳐도 타이머가 학생에게 붙게. 딱 한 명일 때만 붙이고, 동명이인이라
 * 둘 이상 걸리면 누구인지 알 수 없으므로 null(이름 대조로 남긴다).
 */
export async function resolveStudentIdByName(name: string): Promise<number | null> {
  const key = normalizeStudentName(name);
  if (!key) return null;
  const { data } = await supabase.from("students").select("id, name").eq("enrolled", true);
  const hits = (data ?? []).filter(
    (s: { id: number; name: string }) => normalizeStudentName(s.name) === key
  );
  return hits.length === 1 ? hits[0].id : null;
}

export async function createExamTimer(input: {
  studentName: string;
  studentId: number | null;
  examLabel: string | null;
  durationSeconds: number;
  startAtISO: string;
}) {
  await supabase.from("exam_timers").insert({
    student_name: input.studentName,
    student_id: input.studentId,
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
  fields: {
    studentName: string;
    studentId: number | null;
    examLabel: string | null;
    durationSeconds: number;
    startAtISO: string;
  }
) {
  await supabase
    .from("exam_timers")
    .update({
      student_name: fields.studentName,
      student_id: fields.studentId,
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
