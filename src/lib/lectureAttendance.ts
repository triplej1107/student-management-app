import "server-only";
import { supabase } from "./supabase";
import { listStudents } from "./data";
import { getPushSubscriptionsForStudents, sendAttendancePush } from "./clinicPush";
import { isDeployedEnvironment } from "./env";
import { dayLabelOf, kstTimeHHMM, mondayOf, nowKST, toISODate } from "./weeks";
import {
  lectureRosterForDay,
  minutesOfTime,
  missingMessage,
  missingStudents,
  statusForCheckIn,
  type LectureOverride,
  type LectureRosterEntry,
} from "./lectureRules";

export interface LectureAttendanceRow {
  student_id: number;
  session_date: string;
  status: "출석" | "지각" | "결석";
  checked_in_at: string | null;
  source: "macgai7" | "manual";
}

/**
 * 맥가이7 등하원명단에서 읽어온 한 줄.
 *
 * **이 앱과 맥가이7 사이의 유일한 접점이다.** 맥가이7 화면을 긁어오는 쪽은
 * 이 모양으로만 만들어 넘기면 되고, 그 뒤의 판정·기록·알림은 전부 여기서
 * 한다. 긁어오는 방식이 바뀌어도 이 아래는 손댈 일이 없다.
 */
export interface MacgaiCheckIn {
  /** 학번 5자리 — 맥가이7 등하원명단의 "학번" 칸. 앱의 student_code와 같다. */
  studentCode: string;
  /** 등원 시각 "HH:MM" (KST). 맥가이7의 "등원" 칸. */
  checkedInTime: string;
}

export interface SyncResult {
  /** 명단에서 찾아 기록한 학생 수 */
  recorded: number;
  /** 앱 명단에 없는 학번 — 외부생이거나 학번이 안 맞는 경우 */
  unknownCodes: string[];
  /** 이번에 결석으로 잡아 알림을 보낸 학생 수 */
  markedMissing: number;
}

function studentsToRoster(
  dayLabel: string,
  students: Awaited<ReturnType<typeof listStudents>>,
  overrides: Map<number, LectureOverride>
) {
  return lectureRosterForDay(
    students.map((s) => ({
      id: s.id,
      student_code: s.student_code,
      name: s.name,
      class_day: s.class_day,
      class_time: s.class_time,
    })),
    dayLabel,
    overrides
  );
}

/**
 * 그 주에 걸린 강의 시간 조정들.
 *
 * lecture_overrides 행은 "옮겨간 날짜"가 아니라 **원래 수업일**에 달려 있고
 * 목적지는 moved_day/moved_time에 들어있다(클리닉 makeup_schedules와 동일).
 * 그래서 특정 날짜 명단을 만들려면 그 날짜 하나가 아니라 **그 주 전체**를
 * 조회해야 한다 — 다른 날에서 이 날로 옮겨온 학생을 놓치지 않으려면.
 */
async function getOverridesForWeekOf(date: Date): Promise<Map<number, LectureOverride>> {
  const monday = mondayOf(date);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const { data } = await supabase
    .from("lecture_overrides")
    .select("student_id, moved_day, moved_time")
    .gte("session_date", toISODate(monday))
    .lte("session_date", toISODate(sunday));
  const map = new Map<number, LectureOverride>();
  for (const row of (data as { student_id: number; moved_day: string; moved_time: string }[]) ?? []) {
    map.set(row.student_id, {
      studentId: row.student_id,
      movedDay: row.moved_day,
      movedTime: row.moved_time,
    });
  }
  return map;
}

/**
 * 맥가이7에서 읽어온 등원 명단을 그날 강의 출결로 기록하고, 시간이 지나도록
 * 안 찍힌 학생을 결석으로 잡아 학생·학부모에게 알린다.
 *
 * 사람이 직접 고친 기록(source='manual')은 건드리지 않는다 — 조교가 사정을
 * 알고 바꿔둔 것을 다음 동기화가 되돌리면 안 된다.
 *
 * 같은 학생을 두 번 알리지 않는다: 이미 결석으로 적혀 있으면 알림을 다시
 * 보내지 않는다. 10분마다 도는 동안 매번 울리면 안 되기 때문.
 */
export async function syncLectureAttendance(
  checkIns: MacgaiCheckIn[],
  now: Date = nowKST()
): Promise<SyncResult> {
  // nowKST()는 UTC 게터로 읽어야 한국 시각이 된다(weeks.ts 참고).
  const dateISO = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const dayLabel = dayLabelOf(new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const today = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const [students, overrides] = await Promise.all([
    listStudents({ enrolledOnly: true }),
    getOverridesForWeekOf(today),
  ]);
  const roster = studentsToRoster(dayLabel, students, overrides);
  if (roster.length === 0) return { recorded: 0, unknownCodes: [], markedMissing: 0 };

  const byCode = new Map(roster.map((e) => [e.studentCode, e]));
  const existing = await getLectureAttendanceForDate(dateISO);
  const manualIds = new Set(
    existing.filter((r) => r.source === "manual").map((r) => r.student_id)
  );
  const alreadyAbsent = new Set(
    existing.filter((r) => r.status === "결석").map((r) => r.student_id)
  );

  // 1) 찍고 온 학생 — 출석/지각으로 기록.
  const unknownCodes: string[] = [];
  const checkedInIds = new Set<number>();
  const rows: LectureAttendanceRow[] = [];
  for (const c of checkIns) {
    const entry = byCode.get(c.studentCode.trim());
    if (!entry) {
      unknownCodes.push(c.studentCode);
      continue;
    }
    checkedInIds.add(entry.studentId);
    if (manualIds.has(entry.studentId)) continue; // 사람이 고쳐둔 건 그대로
    rows.push({
      student_id: entry.studentId,
      session_date: dateISO,
      status: statusForCheckIn(entry.time, c.checkedInTime),
      checked_in_at: checkInToISO(dateISO, c.checkedInTime),
      source: "macgai7",
    });
  }

  // 2) 시간이 지나도록 안 찍힌 학생 — 결석으로.
  const missing = missingStudents(roster, checkedInIds, nowMinutes).filter(
    (e) => !manualIds.has(e.studentId)
  );
  for (const e of missing) {
    rows.push({
      student_id: e.studentId,
      session_date: dateISO,
      status: "결석",
      checked_in_at: null,
      source: "macgai7",
    });
  }

  if (rows.length > 0) {
    await supabase
      .from("lecture_attendance")
      .upsert(
        rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
        { onConflict: "student_id,session_date" }
      );
  }

  // 3) 이번에 새로 결석이 된 학생에게만 알린다.
  const freshlyMissing = missing.filter((e) => !alreadyAbsent.has(e.studentId));
  await notifyMissing(freshlyMissing);

  return { recorded: rows.length, unknownCodes, markedMissing: freshlyMissing.length };
}

function checkInToISO(dateISO: string, hhmm: string): string | null {
  const minutes = minutesOfTime(hhmm);
  if (minutes === null) return null;
  // KST 벽시계 → 실제 시각. UTC로 9시간 당긴다.
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, minutes) - 9 * 60 * 60 * 1000).toISOString();
}

async function notifyMissing(entries: LectureRosterEntry[]) {
  if (entries.length === 0) return;
  if (!isDeployedEnvironment()) {
    // 로컬은 운영 DB를 그대로 보기 때문에, 화면을 눌러보다 실제 학생 폰으로
    // 알림이 나가는 사고를 막는다(clinicPush와 같은 이유).
    console.warn(`[dry-run] 강의 미출석 알림 대상 ${entries.length}명: ${entries.map((e) => e.name).join(", ")}`);
    return;
  }
  const subsByStudent = await getPushSubscriptionsForStudents(entries.map((e) => e.studentId));
  for (const e of entries) {
    const subs = subsByStudent.get(e.studentId);
    if (subs && subs.length > 0) {
      await sendAttendancePush(subs, e.name, missingMessage(e.time));
    }
  }
}

export async function getLectureAttendanceForDate(dateISO: string): Promise<LectureAttendanceRow[]> {
  const { data } = await supabase
    .from("lecture_attendance")
    .select("student_id, session_date, status, checked_in_at, source")
    .eq("session_date", dateISO);
  return (data as LectureAttendanceRow[]) ?? [];
}

/** 그날 강의가 있는 학생 명단 — 조교·종주T 화면이 "누가 와야 하는지"를 보여줄 때. */
export async function getLectureRosterForDate(date: Date): Promise<LectureRosterEntry[]> {
  const [students, overrides] = await Promise.all([
    listStudents({ enrolledOnly: true }),
    getOverridesForWeekOf(date),
  ]);
  return studentsToRoster(dayLabelOf(date), students, overrides).sort((a, b) =>
    a.time === b.time ? a.name.localeCompare(b.name) : a.time.localeCompare(b.time)
  );
}

/** 조교·종주T가 직접 고친 강의 출결 — 다음 동기화가 덮어쓰지 않게 manual로 남긴다. */
export async function setLectureAttendanceManually(
  studentId: number,
  dateISO: string,
  status: "출석" | "지각" | "결석"
) {
  await supabase.from("lecture_attendance").upsert(
    {
      student_id: studentId,
      session_date: dateISO,
      status,
      source: "manual",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,session_date" }
  );
}

// ============================================================
// 그 주만 강의 시간 옮기기 — 클리닉의 대체 일정과 같은 흐름
// ============================================================

export interface LectureOverrideRow {
  student_id: number;
  session_date: string;
  moved_day: string;
  moved_time: string;
  note: string | null;
}

/**
 * 그 학생의 이번 주 강의를 다른 요일/시간으로 옮긴다.
 *
 * session_date는 **원래 수업일**을 넣는다(옮겨간 날짜가 아니라). 클리닉
 * 대체 일정과 같은 규칙이라 두 화면의 동작이 어긋나지 않는다.
 */
export async function setLectureOverride(
  studentId: number,
  originalDateISO: string,
  movedDay: string,
  movedTime: string,
  note?: string
) {
  await supabase.from("lecture_overrides").upsert(
    {
      student_id: studentId,
      session_date: originalDateISO,
      moved_day: movedDay,
      moved_time: movedTime,
      note: note?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,session_date" }
  );
}

export async function clearLectureOverride(studentId: number, originalDateISO: string) {
  await supabase
    .from("lecture_overrides")
    .delete()
    .eq("student_id", studentId)
    .eq("session_date", originalDateISO);
}

/** 그 주에 걸린 조정들 — 화면에서 "누가 어디로 옮겼는지" 보여줄 때. */
export async function listLectureOverridesForWeekOf(date: Date): Promise<LectureOverrideRow[]> {
  const monday = mondayOf(date);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const { data } = await supabase
    .from("lecture_overrides")
    .select("student_id, session_date, moved_day, moved_time, note")
    .gte("session_date", toISODate(monday))
    .lte("session_date", toISODate(sunday));
  return (data as LectureOverrideRow[]) ?? [];
}

// ============================================================
// 동기화 감시 — 맥가이7이 화면을 바꾸면 조용히 멈추기 때문에
// ============================================================

export async function recordSyncRun(input: { ok: boolean; fetchedCount?: number; error?: string }) {
  await supabase.from("macgai_sync_log").insert({
    ok: input.ok,
    fetched_count: input.fetchedCount ?? null,
    error: input.error ?? null,
  });
}

/** 마지막으로 성공한 동기화 시각. 한 번도 없으면 null. */
export async function getLastSuccessfulSyncAt(): Promise<string | null> {
  const { data } = await supabase
    .from("macgai_sync_log")
    .select("ran_at")
    .eq("ok", true)
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { ran_at: string } | null)?.ran_at ?? null;
}

/** 종주T 화면에 띄울 한 줄 — "마지막 동기화 8/9 19:12" 같은. */
export async function getSyncStatusLabel(): Promise<string | null> {
  const last = await getLastSuccessfulSyncAt();
  if (!last) return null;
  return `${toISODate(new Date(last))} ${kstTimeHHMM(last)}`;
}
