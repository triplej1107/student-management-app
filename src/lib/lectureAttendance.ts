import "server-only";
import { supabase } from "./supabase";
import { getAttendanceMapForDate, getRosterForDate, listStudents } from "./data";
import { getAutoMarkedSetForDate } from "./attendanceAuto";
import { getPushSubscriptionsForStudents, sendAttendancePush } from "./clinicPush";
import { isDeployedEnvironment } from "./env";
import type { ClassKey } from "./types";
import { dayLabelOf, kstTimeHHMM, mondayOf, nowKST, toISODate } from "./weeks";
import {
  lectureRosterForDay,
  minutesOfTime,
  missingMessage,
  missingStudents,
  statusForCheckIn,
  needsMakeup,
  shouldFillClinicFromKiosk,
  type LectureOverride,
  type LectureRosterEntry,
  type LectureStatus,
} from "./lectureRules";

export interface LectureAttendanceRow {
  student_id: number;
  session_date: string;
  status: LectureStatus;
  checked_in_at: string | null;
  source: "macgai7" | "manual";
  /** 결석/지각 사유 — 맥가이7에서 들어오거나 조교가 앱에서 직접 적는다. */
  absence_reason?: string | null;
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
  now: Date = nowKST(),
  /** 학번 → 맥가이7에 적힌 결석/지각 사유. 앱이 비어 있을 때만 채운다. */
  reasons: Record<string, string> = {}
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

  // 찍고 온 사람은 **재원생 전체**와 맞춘다 — 그날 강의 명단이 아니라.
  //
  // 등하원 로그는 학급에 묶이지 않은 날것이라, 강의 없이 클리닉만 하러 온
  // 학생도 그대로 들어온다. 예전처럼 강의 명단하고만 맞추면 그런 학생은
  // "모르는 학번"으로 버려져서 클리닉 출결이 자동으로 안 채워졌다.
  const idByCode = new Map(students.map((s) => [s.student_code, s.id]));
  const unknownCodes: string[] = [];
  /** 그날 문을 통과한 재원생 → 제일 이른 등원 시각. 클리닉 출결은 이걸로 채운다. */
  const kioskAt = new Map<number, string>();
  for (const c of checkIns) {
    const id = idByCode.get(c.studentCode.trim());
    if (id == null) {
      unknownCodes.push(c.studentCode);
      continue;
    }
    const prev = kioskAt.get(id);
    if (prev === undefined || c.checkedInTime < prev) kioskAt.set(id, c.checkedInTime);
  }

  // 강의가 없는 날(평일 클리닉만)은 강의 출결 계산을 통째로 건너뛴다.
  // 예전에는 여기서 바로 돌아가버려서 클리닉까지 같이 멈췄다.
  if (roster.length > 0) {
    const lecture = await syncLectureRows({
      roster,
      checkIns,
      reasons,
      dateISO,
      nowMinutes,
    });
    await fillClinicFromKiosk(kioskAt, today, dateISO);
    return { recorded: lecture.recorded, unknownCodes, markedMissing: lecture.markedMissing };
  }

  await fillClinicFromKiosk(kioskAt, today, dateISO);
  return { recorded: 0, unknownCodes, markedMissing: 0 };
}

/**
 * 강의 출결 부분만 — 명단이 있는 날에만 돈다.
 *
 * syncLectureAttendance에서 떼어낸 것이다. 강의가 없는 날에도 클리닉은
 * 채워야 해서, 둘을 한 덩어리로 두면 어느 한쪽을 건너뛸 수 없었다.
 */
async function syncLectureRows(args: {
  roster: LectureRosterEntry[];
  checkIns: MacgaiCheckIn[];
  reasons: Record<string, string>;
  dateISO: string;
  nowMinutes: number;
}): Promise<{ recorded: number; markedMissing: number }> {
  const { roster, checkIns, reasons, dateISO, nowMinutes } = args;

  const byCode = new Map(roster.map((e) => [e.studentCode, e]));
  const existing = await getLectureAttendanceForDate(dateISO);
  const manualIds = new Set(
    existing.filter((r) => r.source === "manual").map((r) => r.student_id)
  );
  const alreadyAbsent = new Set(
    existing.filter((r) => r.status === "결석").map((r) => r.student_id)
  );
  // 이미 적혀 있는 사유는 그대로 둔다 — 조교가 앱에 더 자세히 적어둔 사정이
  // 맥가이7의 짧은 메모로 지워지면 안 된다.
  const existingReason = new Map(
    existing.filter((r) => r.absence_reason).map((r) => [r.student_id, r.absence_reason as string])
  );
  const reasonFor = (studentId: number, code: string) =>
    existingReason.get(studentId) ?? reasons[code]?.trim() ?? null;

  // 1) 찍고 온 학생 — 출석/지각으로 기록.
  //    모르는 학번은 부르는 쪽에서 이미 걸러 모아뒀다.
  const checkedInIds = new Set<number>();
  const rows: LectureAttendanceRow[] = [];
  for (const c of checkIns) {
    const entry = byCode.get(c.studentCode.trim());
    if (!entry) continue;
    checkedInIds.add(entry.studentId);
    if (manualIds.has(entry.studentId)) continue; // 사람이 고쳐둔 건 그대로
    rows.push({
      student_id: entry.studentId,
      session_date: dateISO,
      status: statusForCheckIn(entry.time, c.checkedInTime),
      checked_in_at: checkInToISO(dateISO, c.checkedInTime),
      source: "macgai7",
      absence_reason: reasonFor(entry.studentId, c.studentCode),
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
      absence_reason: reasonFor(e.studentId, e.studentCode),
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

  return { recorded: rows.length, markedMissing: freshlyMissing.length };
}

/**
 * 키오스크에 찍힌 학생 중 그날 클리닉도 있는 사람의 클리닉 출결을 채운다.
 *
 * 등원 시각을 클리닉 시작 시각과 견줘 **출석/지각**을 가른다. 예전에는 무조건
 * 출석으로 뒀는데, 그때는 강의 학급별 조회밖에 없어서 찍힌 시각이 "강의 때문에
 * 온 시각"이라 클리닉 시작과 비교하는 게 의미가 없었기 때문이다. 지금은 학급에
 * 안 묶인 등하원 로그를 읽으므로 그 시각이 곧 문을 통과한 시각이고, 클리닉만
 * 하러 온 학생도 그대로 잡힌다 — 비교가 의미를 갖는다.
 *
 * 아침 강의 때문에 일찍 온 학생은 오후 클리닉 시작보다 이르니 그대로 출석이다.
 *
 * 자동으로 찍혀 있던 줄(auto_marked)은 키오스크 기록이 더 정확하므로 덮어쓰고,
 * 그 과정에서 auto_marked도 꺼진다. 안 와서 결석으로 표시됐던 학생이 늦게
 * 도착하면 이 경로로 지각이 된다.
 */
async function fillClinicFromKiosk(
  checkedInAt: Map<number, string>,
  date: Date,
  dateISO: string
) {
  if (checkedInAt.size === 0) return;

  const clinicRoster = await getRosterForDate(date);
  const clinicToday = clinicRoster.filter((r) => checkedInAt.has(r.student.id));
  if (clinicToday.length === 0) return;

  const [existing, autoMarked] = await Promise.all([
    getAttendanceMapForDate(date),
    getAutoMarkedSetForDate(date),
  ]);

  const rows = clinicToday
    .filter((r) =>
      shouldFillClinicFromKiosk(existing.has(r.student.id), autoMarked.has(r.student.id))
    )
    .map((r) => ({
      student_id: r.student.id,
      session_date: dateISO,
      status: statusForCheckIn(r.effTime, checkedInAt.get(r.student.id)!),
      marked_by: null,
      auto_marked: false,
      created_at: new Date().toISOString(),
    }));
  if (rows.length === 0) return;

  await supabase
    .from("attendance_records")
    .upsert(rows, { onConflict: "student_id,session_date" });
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

/** 그날 강의 명단 + 출결 + 보강 필요 여부를 반별로 묶은 것 — 화면이 쓰는 형태. */
export interface LectureAttendanceEntry {
  studentId: number;
  studentCode: string;
  name: string;
  classKey: ClassKey | null;
  time: string;
  /** 그 주만 시간을 옮겨 이 날짜로 온 학생 */
  moved: boolean;
  status: LectureStatus | null;
  /** 맥가이7에서 자동으로 들어온 값인지 — 사람이 고쳤으면 false */
  auto: boolean;
  checkedInAt: string | null;
  /** 옮겨둔(또는 보강으로 잡아둔) 일정 */
  makeupDay: string | null;
  makeupTime: string | null;
  /** 결석인데 보강 일정이 아직 없음 */
  needsMakeup: boolean;
  /** 결석/지각 사유 — 맥가이7에서 들어오거나 조교가 적은 것 */
  absenceReason: string | null;
}

/**
 * 강의 출결 화면 한 판 — 그날 와야 하는 학생, 찍힌 출결, 보강 필요 여부까지.
 * 조교 화면과 종주T 화면이 같은 것을 본다(권한 차이는 화면에서 다룬다).
 */
export async function getLectureAttendanceBoard(date: Date): Promise<LectureAttendanceEntry[]> {
  const dateISO = toISODate(date);
  const [students, overrides, records] = await Promise.all([
    listStudents({ enrolledOnly: true }),
    getOverridesForWeekOf(date),
    getLectureAttendanceForDate(dateISO),
  ]);
  const roster = studentsToRoster(dayLabelOf(date), students, overrides);
  const byId = new Map(students.map((s) => [s.id, s]));
  const recordByStudent = new Map(records.map((r) => [r.student_id, r]));

  return roster
    .map((entry) => {
      const record = recordByStudent.get(entry.studentId);
      const override = overrides.get(entry.studentId);
      const status = (record?.status as LectureStatus | undefined) ?? null;
      return {
        studentId: entry.studentId,
        studentCode: entry.studentCode,
        name: entry.name,
        classKey: byId.get(entry.studentId)?.class_key ?? null,
        time: entry.time,
        moved: entry.moved,
        status,
        auto: record?.source === "macgai7",
        checkedInAt: record?.checked_in_at ?? null,
        makeupDay: override?.movedDay ?? null,
        makeupTime: override?.movedTime ?? null,
        needsMakeup: status ? needsMakeup(status, !!override) : false,
        absenceReason: record?.absence_reason ?? null,
      };
    })
    .sort((a, b) => (a.time === b.time ? a.name.localeCompare(b.name) : a.time.localeCompare(b.time)));
}

/** 조교·종주T가 직접 고친 강의 출결 — 다음 동기화가 덮어쓰지 않게 manual로 남긴다. */
export async function setLectureAttendanceManually(
  studentId: number,
  dateISO: string,
  status: LectureStatus
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

/**
 * 조교·종주T가 직접 적는 결석/지각 사유.
 *
 * 출결 상태는 건드리지 않는다 — 사유를 적었다고 자동 동기화를 멈추면, 뒤늦게
 * 온 학생이 키오스크를 찍어도 결석으로 굳어버린다. 대신 사유 칸 자체는 한 번
 * 채워지면 맥가이7이 덮지 않는다(syncLectureAttendance 참고).
 *
 * 빈 값으로 저장하면 지운다.
 */
export async function setLectureAbsenceReason(
  studentId: number,
  dateISO: string,
  reason: string
) {
  const trimmed = reason.trim();
  await supabase.from("lecture_attendance").upsert(
    {
      student_id: studentId,
      session_date: dateISO,
      absence_reason: trimmed || null,
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
