import "server-only";
import { supabase } from "./supabase";
import {
  toISODate,
  weekLabel,
  dayLabelOf,
  mondayOf,
  parseISODate,
  kstToday,
  kstTimeHHMM,
  makeupDateISO,
} from "./weeks";
import { classKeyFor } from "./classKey";
import { syncSlimeWeek } from "./slimeXp";
import { SCHOOL_EXAMS } from "./types";
import type {
  AttendanceStatus,
  CalendarNote,
  ClassKey,
  ClassPlan,
  ClinicCheck,
  ClinicPercentilePoint,
  ClinicTemplate,
  DutyCheck,
  DutyItem,
  FeedbackTags,
  MakeupSchedule,
  MockExam,
  Notice,
  SchoolExam,
  Staff,
  Student,
  StudentOverrides,
  TestScore,
} from "./types";

// ============================================================
// students
// ============================================================

export async function getStudentById(id: number): Promise<Student | null> {
  const { data } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  return (data as Student) ?? null;
}

/** 학생/학부모 계정이 설치된(standalone) 상태로 홈 화면을 연 시각을 기록 —
 * 실시간 설치 여부를 아는 API가 없어서 쓰는 근사치. */
export async function markAppSeenInstalled(studentId: number, role: "student" | "parent") {
  const column = role === "student" ? "student_app_seen_at" : "parent_app_seen_at";
  await supabase
    .from("students")
    .update({ [column]: new Date().toISOString() })
    .eq("id", studentId);
}

export async function listStudents(opts?: { enrolledOnly?: boolean }): Promise<Student[]> {
  let query = supabase.from("students").select("*").order("name");
  if (opts?.enrolledOnly) query = query.eq("enrolled", true);
  const { data } = await query;
  return (data as Student[]) ?? [];
}

/** 연도 무시, 월/일만 비교해 오늘이 생일인지 판정. */
export function isBirthdayToday(birthday: string | null, today: Date): boolean {
  if (!birthday) return false;
  const [, m, d] = birthday.split("-").map(Number);
  return m === today.getMonth() + 1 && d === today.getDate();
}

/** 오늘 생일인 재원생 목록 — 생일 UJC 지급 크론이 쓴다. */
export async function getStudentsWithBirthdayToday(today: Date): Promise<Student[]> {
  const students = await listStudents({ enrolledOnly: true });
  return students.filter((s) => isBirthdayToday(s.birthday, today));
}

export async function listStudentsByClass(classKey: ClassKey): Promise<Student[]> {
  const { data } = await supabase
    .from("students")
    .select("*")
    .eq("class_key", classKey)
    .eq("enrolled", true)
    .order("name");
  return (data as Student[]) ?? [];
}

export async function updateStudentAppFields(
  id: number,
  fields: Partial<
    Pick<
      Student,
      "class_key" | "main_book" | "hw_book" | "mgmt_book" | "status" | "note_to_next_ta"
    >
  >
) {
  await supabase
    .from("students")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function updateStudentOverrides(id: number, overrides: StudentOverrides) {
  await supabase
    .from("students")
    .update({ overrides, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export type RosterFieldUpdate = Partial<
  Pick<
    Student,
    | "name"
    | "student_code"
    | "nickname"
    | "enrolled"
    | "level"
    | "school"
    | "grade"
    | "parent_phone"
    | "student_phone"
    | "class_day"
    | "class_time"
    | "clinic_day"
    | "clinic_time"
    | "birthday"
    | "first_lesson_date"
    | "referral_note"
  >
>;

export async function updateStudentRosterFields(id: number, fields: RosterFieldUpdate) {
  const withdrawnAt =
    fields.enrolled === undefined ? {} : { withdrawn_at: fields.enrolled ? null : new Date().toISOString() };
  await supabase
    .from("students")
    .update({ ...fields, ...withdrawnAt, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export interface NewStudentInput extends RosterFieldUpdate {
  student_code: string;
  name: string;
  class_key: ClassKey;
}

export async function createStudent(input: NewStudentInput): Promise<Student> {
  const { data, error } = await supabase
    .from("students")
    .insert({
      ...input,
      enrolled: input.enrolled ?? true,
      main_book: false,
      hw_book: false,
      mgmt_book: false,
      status: "",
      note_to_next_ta: "",
      overrides: {},
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Student;
}

export async function deleteStudent(id: number) {
  await supabase.from("students").delete().eq("id", id);
}

export async function bulkDeleteStudents(ids: number[]) {
  if (ids.length === 0) return;
  await supabase.from("students").delete().in("id", ids);
}

export async function bulkSetClassKey(ids: number[], classKey: ClassKey) {
  if (ids.length === 0) return;
  await supabase
    .from("students")
    .update({ class_key: classKey, updated_at: new Date().toISOString() })
    .in("id", ids);
}

export async function bulkSetEnrolled(ids: number[], enrolled: boolean) {
  if (ids.length === 0) return;
  await supabase
    .from("students")
    .update({
      enrolled,
      withdrawn_at: enrolled ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", ids);
}

export interface BulkImportRow extends RosterFieldUpdate {
  student_code: string;
  name: string;
}

export interface BulkImportResult {
  inserted: number;
  updated: number;
  errors: { row: number; message: string }[];
}

/** Upserts by student_code — new students are inserted (with class_key
 * guessed via classKeyFor), existing students only have their roster
 * columns refreshed. App-owned columns (class_key after the fact,
 * main_book/hw_book/mgmt_book/status/note_to_next_ta/overrides) are never
 * touched on update, matching the same rule the old sheet sync followed. */
export async function bulkImportStudents(rows: BulkImportRow[]): Promise<BulkImportResult> {
  const result: BulkImportResult = { inserted: 0, updated: 0, errors: [] };
  if (rows.length === 0) return result;

  const { data: existingRows } = await supabase.from("students").select("id, student_code");
  const existingCodes = new Map((existingRows ?? []).map((r) => [r.student_code, r.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { student_code, name, ...rosterFields } = row;
    if (!student_code || !name) {
      result.errors.push({ row: i + 1, message: "학번과 이름은 필수예요." });
      continue;
    }
    if (!/^\d{5}$/.test(student_code)) {
      result.errors.push({ row: i + 1, message: `학번(${student_code})은 5자리 숫자여야 해요.` });
      continue;
    }

    const existingId = existingCodes.get(student_code);
    if (existingId) {
      // Blank pasted cells mean "leave unchanged" on update (not "clear the
      // field") — bulk import is often a partial re-paste, not a full
      // authoritative snapshot.
      const nonBlankFields = Object.fromEntries(
        Object.entries(rosterFields).filter(([, v]) => v !== null)
      );
      const { error } = await supabase
        .from("students")
        .update({ name, ...nonBlankFields, updated_at: new Date().toISOString() })
        .eq("id", existingId);
      if (error) {
        result.errors.push({ row: i + 1, message: error.message });
      } else {
        result.updated++;
      }
    } else {
      const { error } = await supabase.from("students").insert({
        student_code,
        name,
        ...rosterFields,
        class_key: classKeyFor({
          level: rosterFields.level ?? null,
          school: rosterFields.school ?? null,
          grade: rosterFields.grade ?? null,
        }),
        enrolled: rosterFields.enrolled ?? true,
        main_book: false,
        hw_book: false,
        mgmt_book: false,
        status: "",
        note_to_next_ta: "",
        overrides: {},
      });
      if (error) {
        result.errors.push({ row: i + 1, message: error.message });
      } else {
        result.inserted++;
        existingCodes.set(student_code, -1); // avoid double-insert on duplicate rows within the same paste
      }
    }
  }

  return result;
}

export async function searchStudents(query: {
  name?: string;
  school?: string;
  grade?: string;
}): Promise<Student[]> {
  let q = supabase.from("students").select("*").order("name").limit(30);
  if (query.name) q = q.ilike("name", `%${query.name}%`);
  if (query.school) q = q.ilike("school", `%${query.school}%`);
  if (query.grade) q = q.eq("grade", query.grade);
  const { data } = await q;
  return (data as Student[]) ?? [];
}

// ============================================================
// makeup schedules — date-scoped (keyed to the original session_date)
// ============================================================

export async function getMakeupMapForWeek(
  weekStart: Date,
  weekEnd: Date
): Promise<Map<number, MakeupSchedule>> {
  const { data } = await supabase
    .from("makeup_schedules")
    .select("*")
    .gte("session_date", toISODate(weekStart))
    .lte("session_date", toISODate(weekEnd));
  const map = new Map<number, MakeupSchedule>();
  for (const row of (data as MakeupSchedule[]) ?? []) {
    map.set(row.student_id, row);
  }
  return map;
}

export async function setMakeup(
  studentId: number,
  sessionDate: Date,
  makeupDay: string,
  makeupTime: string,
  note?: string
) {
  await supabase.from("makeup_schedules").upsert(
    {
      student_id: studentId,
      session_date: toISODate(sessionDate),
      makeup_day: makeupDay,
      makeup_time: makeupTime,
      note: note ?? null,
    },
    { onConflict: "student_id,session_date" }
  );
}

export async function clearMakeup(studentId: number, sessionDate: Date) {
  await supabase
    .from("makeup_schedules")
    .delete()
    .eq("student_id", studentId)
    .eq("session_date", toISODate(sessionDate));
}

export interface RosterEntry {
  student: Student;
  effDay: string;
  effTime: string;
  hasMakeup: boolean;
  makeup?: MakeupSchedule;
}

/** Enrolled students' effective clinic day/time this week (accounting for
 * any makeup schedule) — fetches students + makeup map once so pages that
 * need both a day's roster and the full set of active days don't each
 * re-query the same data. */
export async function getWeeklyRoster(weekStart: Date, weekEnd: Date): Promise<RosterEntry[]> {
  const [students, makeupMap] = await Promise.all([
    listStudents({ enrolledOnly: true }),
    getMakeupMapForWeek(weekStart, weekEnd),
  ]);

  return students.map((student) => {
    const makeup = makeupMap.get(student.id);
    const effDay = makeup?.makeup_day ?? student.clinic_day ?? "";
    const effTime = makeup?.makeup_time ?? student.clinic_time ?? "";
    return { student, effDay, effTime, hasMakeup: !!makeup, makeup };
  });
}

/** Distinct effective clinic days among enrolled students this week, in
 * 월~일 order — used to render only the day tabs that actually have students. */
export function activeClinicDaysFrom(roster: RosterEntry[]): string[] {
  const days = new Set(roster.map((r) => r.effDay).filter(Boolean));
  const DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"];
  return DAY_ORDER.filter((d) => days.has(d));
}

/** Enrolled students whose *effective* clinic day (accounting for this
 * week's makeup schedule) equals `day`. */
export async function getRosterForDay(
  day: string,
  weekStart: Date,
  weekEnd: Date
): Promise<RosterEntry[]> {
  const roster = await getWeeklyRoster(weekStart, weekEnd);
  return roster.filter((entry) => entry.effDay === day);
}

/** Distinct effective clinic days among enrolled students this week. */
export async function getActiveClinicDays(weekStart: Date, weekEnd: Date): Promise<string[]> {
  return activeClinicDaysFrom(await getWeeklyRoster(weekStart, weekEnd));
}

/** 특정 날짜에 실제로 클리닉이 있는(대체 일정 반영) 학생 명단 — 주 단위가
 * 아니라 임의의 하루(예: 자동 결석 크론의 "오늘", 전날 자동 결석 이월 목록의
 * "어제")를 조회할 때 쓴다.
 *
 * makeup_schedules 행은 "옮겨간 날짜"가 아니라 **원래 수업일**(session_date)에
 * 달려 있고 목적지는 makeup_day에 들어있다 — 그래서 "그 날짜의 makeup 행"을
 * 찾는 방식으로는 조정된 학생을 절대 잡을 수 없다(수요일에서 금요일로 옮긴
 * 학생의 행은 session_date가 수요일이다). 출결 화면과 똑같이 주 단위로 조회한
 * 뒤 effDay로 거르는 getRosterForDay에 위임해야 결과가 일치한다. */
export async function getRosterForDate(date: Date): Promise<RosterEntry[]> {
  const weekStart = mondayOf(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return getRosterForDay(dayLabelOf(date), weekStart, weekEnd);
}

export interface AutoAbsenceGroup {
  dateISO: string;
  entries: RosterEntry[];
}

/** 지난 며칠 사이 시스템이 자동 결석 처리했는데 아직 아무도 확인·정정하지
 * 않은(auto_marked가 여전히 true인) 건들을 날짜별로 묶어 반환 — 출결 화면
 * 맨 위 "확인 필요" 목록에 쓴다.
 *
 * 밤 10시 자동 결석은 조교가 이미 퇴근한 뒤라 그날 처리할 수 없다. 다음 날
 * 출근해서 "어제 얘네 결국 안 왔네" 하고 연락·조정하는 흐름이라 항상 그
 * **이전** 날짜들만 본다. 어제 하루만 보면 일요일처럼 아무도 앱을 안 여는
 * 날을 건너뛰며 토요일 건이 영영 안 보이므로 며칠치를 훑는다. 조교가 출결
 * 버튼을 누르면 auto_marked가 꺼지면서(setAttendance) 목록에서 사라진다. */
export async function getUnresolvedAutoAbsences(
  today: Date,
  lookbackDays = 7
): Promise<AutoAbsenceGroup[]> {
  const start = new Date(today);
  start.setDate(start.getDate() - lookbackDays);

  const { data } = await supabase
    .from("attendance_records")
    .select("student_id, session_date")
    .gte("session_date", toISODate(start))
    .lt("session_date", toISODate(today))
    .eq("auto_marked", true)
    .eq("status", "결석");

  const rows = (data as { student_id: number; session_date: string }[]) ?? [];
  if (rows.length === 0) return [];

  const idsByDate = new Map<string, Set<number>>();
  for (const row of rows) {
    const set = idsByDate.get(row.session_date) ?? new Set<number>();
    set.add(row.student_id);
    idsByDate.set(row.session_date, set);
  }

  const dates = Array.from(idsByDate.keys()).sort();
  const groups = await Promise.all(
    dates.map(async (dateISO) => {
      const roster = await getRosterForDate(parseISODate(dateISO));
      const ids = idsByDate.get(dateISO)!;
      return { dateISO, entries: roster.filter((r) => ids.has(r.student.id)) };
    })
  );
  return groups.filter((g) => g.entries.length > 0);
}

// ============================================================
// attendance
// ============================================================

export async function getAttendanceMapForDate(
  date: Date
): Promise<Map<number, AttendanceStatus>> {
  const { data } = await supabase
    .from("attendance_records")
    .select("student_id, status")
    .eq("session_date", toISODate(date));
  const map = new Map<number, AttendanceStatus>();
  for (const row of data ?? []) {
    map.set(row.student_id, row.status as AttendanceStatus);
  }
  return map;
}

export interface AttendanceLogEntry {
  dateISO: string;
  status: AttendanceStatus;
  /** 그 출결이 기록된 시각(KST "HH:MM") — 조교가 버튼을 누른 시각, 또는
   * 시스템이 자동 지각/결석 처리한 시각. 학생이 실제로 도착한 시각은 앱이
   * 알 수 없어서(키오스크 쪽 정보) 이 값이 가장 가까운 근사치다.
   * 사람이 출결을 고치면 그 시점으로 갱신된다(setAttendance 참고). */
  recordedAt: string;
  /** 그날 잡아둔 대체 일정 — "언제로 옮겼는지"를 같이 보여준다.
   * 조교 전달사항(note)은 내부용이라 일부러 뺐다. */
  makeupDateISO: string | null;
  makeupTime: string | null;
}

/** 학부모 홈의 "클리닉 출결 로그" — 그 학생의 출결 기록을 최신순으로.
 * 학부모가 푸시 알림을 놓쳤거나 앱 설치에 실패했을 때 기록으로 확인하는
 * 용도라, 알림을 보냈든 안 보냈든 남아있는 기록을 그대로 보여준다.
 *
 * 정렬은 "실제로 그 수업이 있었던 날" 기준이다. 대체 일정이 잡힌 건은
 * 원래 수업일이 아니라 **옮겨간 날짜**로 줄을 세우고, 같은 날짜라면 그날
 * 실제 출결(출석 등)을 위에, 그날로 옮겨온 조정 기록을 그 아래에 둔다.
 * 예: 8/7(금) 수업을 8/5(수)로 옮겨 8/5에 왔다면 "8/5 출석"이 위,
 * "8/7 → 8/5로 조정"이 바로 아래. 학부모가 위에서부터 읽으면 온 날이
 * 먼저 보이고 그 이유가 뒤따른다. */
export async function getAttendanceLogForStudent(
  studentId: number,
  sinceISO: string
): Promise<AttendanceLogEntry[]> {
  const [records, makeups] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("session_date, status, created_at")
      .eq("student_id", studentId)
      .gte("session_date", sinceISO)
      .order("session_date", { ascending: false }),
    supabase
      .from("makeup_schedules")
      .select("session_date, makeup_day, makeup_time")
      .eq("student_id", studentId)
      .gte("session_date", sinceISO),
  ]);

  const makeupByDate = new Map<string, { makeup_day: string; makeup_time: string }>();
  for (const m of makeups.data ?? []) {
    makeupByDate.set(m.session_date, { makeup_day: m.makeup_day, makeup_time: m.makeup_time });
  }

  type Row = { session_date: string; status: AttendanceStatus; created_at: string };
  const entries: AttendanceLogEntry[] = ((records.data as Row[]) ?? []).map((r) => {
    const makeup = makeupByDate.get(r.session_date);
    const movedTo = makeup ? makeupDateISO(r.session_date, makeup.makeup_day) : null;
    return {
      dateISO: r.session_date,
      status: r.status,
      recordedAt: kstTimeHHMM(r.created_at),
      makeupDateISO: movedTo,
      makeupTime: movedTo ? makeup!.makeup_time : null,
    };
  });

  return entries.sort((a, b) => {
    const ea = a.makeupDateISO ?? a.dateISO;
    const eb = b.makeupDateISO ?? b.dateISO;
    if (ea !== eb) return eb.localeCompare(ea); // 실제 수업일 최신순
    // 같은 날: 그날 실제 출결이 위, 그날로 옮겨온 조정이 아래.
    const am = a.makeupDateISO ? 1 : 0;
    const bm = b.makeupDateISO ? 1 : 0;
    if (am !== bm) return am - bm;
    return b.dateISO.localeCompare(a.dateISO);
  });
}

export async function setAttendance(
  studentId: number,
  date: Date,
  status: AttendanceStatus,
  markedBy: number | null
) {
  await supabase.from("attendance_records").upsert(
    {
      student_id: studentId,
      session_date: toISODate(date),
      status,
      marked_by: markedBy,
      // 사람이 직접 누른 것이므로 자동 결석 플래그는 항상 해제.
      auto_marked: false,
      // 사람이 누른 "지금"으로 시각을 새로 찍는다 — 이 값이 학부모 출결
      // 로그에 그대로 뜬다. 자동 지각(15:10)으로 잡혔다가 조교가 출석
      // (15:30)으로 고치면 15:30이 남아야 하기 때문. 자동 처리 쪽은
      // created_at을 건드리지 않으므로 자동 처리 시각이 그대로 유지된다.
      created_at: new Date().toISOString(),
    },
    { onConflict: "student_id,session_date" }
  );
  await syncSlimeWeek(studentId, date);
}

export async function clearAttendance(studentId: number, date: Date) {
  await supabase
    .from("attendance_records")
    .delete()
    .eq("student_id", studentId)
    .eq("session_date", toISODate(date));
  await syncSlimeWeek(studentId, date);
}

/** 2학기 전까지만 쓰는 임시 기능 — 학부모에게 문자를 보냈는지 체크. */
export async function setParentTexted(studentId: number, date: Date, texted: boolean) {
  await supabase
    .from("attendance_records")
    .update({ parent_texted: texted })
    .eq("student_id", studentId)
    .eq("session_date", toISODate(date));
}

export async function getParentTextedMapForDate(date: Date): Promise<Map<number, boolean>> {
  const { data } = await supabase
    .from("attendance_records")
    .select("student_id, parent_texted")
    .eq("session_date", toISODate(date));
  const map = new Map<number, boolean>();
  for (const row of data ?? []) {
    map.set(row.student_id, !!row.parent_texted);
  }
  return map;
}

// ============================================================
// clinic templates & checks
// ============================================================

export async function getClinicTemplate(
  classKey: ClassKey,
  weekStart: Date
): Promise<ClinicTemplate | null> {
  const { data } = await supabase
    .from("clinic_templates")
    .select("*")
    .eq("class_key", classKey)
    .eq("week_start", toISODate(weekStart))
    .maybeSingle();
  return (data as ClinicTemplate) ?? null;
}

export async function getClinicTemplatesForWeek(
  weekStart: Date
): Promise<Map<ClassKey, ClinicTemplate>> {
  const { data } = await supabase
    .from("clinic_templates")
    .select("*")
    .eq("week_start", toISODate(weekStart));
  const map = new Map<ClassKey, ClinicTemplate>();
  for (const row of (data as ClinicTemplate[]) ?? []) {
    map.set(row.class_key, row);
  }
  return map;
}

export async function upsertClinicTemplate(
  classKey: ClassKey,
  weekStart: Date,
  fields: { month: string; round: string; hwLabels: string[]; testLabels: string[] }
) {
  await supabase.from("clinic_templates").upsert(
    {
      class_key: classKey,
      week_start: toISODate(weekStart),
      month: fields.month,
      round: fields.round,
      hw_labels: fields.hwLabels,
      test_labels: fields.testLabels,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "class_key,week_start" }
  );
}

export async function getClinicCheck(
  studentId: number,
  weekStart: Date
): Promise<ClinicCheck | null> {
  const { data } = await supabase
    .from("clinic_checks")
    .select("*")
    .eq("student_id", studentId)
    .eq("week_start", toISODate(weekStart))
    .maybeSingle();
  return (data as ClinicCheck) ?? null;
}

export async function getClinicChecksForStudents(
  studentIds: number[],
  weekStart: Date
): Promise<Map<number, ClinicCheck>> {
  if (studentIds.length === 0) return new Map();
  const { data } = await supabase
    .from("clinic_checks")
    .select("*")
    .in("student_id", studentIds)
    .eq("week_start", toISODate(weekStart));
  const map = new Map<number, ClinicCheck>();
  for (const row of (data as ClinicCheck[]) ?? []) {
    map.set(row.student_id, row);
  }
  return map;
}

/** AI 피드백 생성 시 "저번 주와 다른 표현 쓰기" 참고용 — 같은 학생의
 * 최근 피드백 문장들(현재 주차 제외)을 최신순으로 가져온다. */
export async function getRecentFeedbackTexts(
  studentId: number,
  excludeWeekStartISO: string,
  limit = 3
): Promise<string[]> {
  const { data } = await supabase
    .from("clinic_checks")
    .select("feedback_text, week_start")
    .eq("student_id", studentId)
    .not("feedback_text", "is", null)
    .neq("week_start", excludeWeekStartISO)
    .order("week_start", { ascending: false })
    .limit(limit);
  return ((data as { feedback_text: string | null }[]) ?? [])
    .map((r) => r.feedback_text)
    .filter((t): t is string => !!t);
}

export async function setClinicHwCheck(
  studentId: number,
  weekStart: Date,
  hwChecks: boolean[]
) {
  await supabase.from("clinic_checks").upsert(
    {
      student_id: studentId,
      week_start: toISODate(weekStart),
      hw_checks: hwChecks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,week_start" }
  );
  await syncSlimeWeek(studentId, weekStart);
}

export async function setClinicTestScores(
  studentId: number,
  weekStart: Date,
  testScores: TestScore[]
) {
  await supabase.from("clinic_checks").upsert(
    {
      student_id: studentId,
      week_start: toISODate(weekStart),
      test_scores: testScores,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,week_start" }
  );
  await syncSlimeWeek(studentId, weekStart);
}

/** "조교 결재" — a TA signing off on a student's weekly checklist. Tracks
 * who most recently signed it; unchecking clears the who/when. */
export async function setStaffApproval(
  studentId: number,
  weekStart: Date,
  approved: boolean,
  staffId: number
) {
  await supabase.from("clinic_checks").upsert(
    {
      student_id: studentId,
      week_start: toISODate(weekStart),
      staff_approved: approved,
      staff_approved_by: approved ? staffId : null,
      staff_approved_at: approved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,week_start" }
  );
}

/** "종주T 최종 결재" — shared admin account, no per-approver identity to track. */
export async function setZongjuApproval(studentId: number, weekStart: Date, approved: boolean) {
  await supabase.from("clinic_checks").upsert(
    {
      student_id: studentId,
      week_start: toISODate(weekStart),
      zongju_approved: approved,
      zongju_approved_at: approved ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,week_start" }
  );
}

export async function setClinicFeedback(
  studentId: number,
  weekStart: Date,
  fields: Partial<{ feedback_tags: FeedbackTags; feedback_text: string }>
) {
  await supabase.from("clinic_checks").upsert(
    {
      student_id: studentId,
      week_start: toISODate(weekStart),
      ...fields,
      feedback_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,week_start" }
  );
}

/** 종주T가 직접 쓰는 별도 피드백 — 조교 AI 피드백과 달리 결재 게이트
 * 없이 저장 즉시 학부모에게 노출된다. */
export async function setZongjuFeedback(studentId: number, weekStart: Date, text: string) {
  await supabase.from("clinic_checks").upsert(
    {
      student_id: studentId,
      week_start: toISODate(weekStart),
      zongju_feedback_text: text,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,week_start" }
  );
}

export async function getStaffNameMap(): Promise<Map<number, string>> {
  const { data } = await supabase.from("staff").select("id, name");
  return new Map((data ?? []).map((s) => [s.id, s.name]));
}

// ============================================================
// notices
// ============================================================

export async function listNoticesForClass(
  classKey: ClassKey,
  limit?: number
): Promise<Notice[]> {
  let q = supabase
    .from("notices")
    .select("*")
    .eq("class_key", classKey)
    .order("notice_date", { ascending: false })
    .order("id", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data } = await q;
  return (data as Notice[]) ?? [];
}

export async function createNotice(classKey: ClassKey) {
  const { data } = await supabase
    .from("notices")
    .insert({ class_key: classKey, title: "", notice_date: toISODate(kstToday()), tag: "", content: "" })
    .select("*")
    .single();
  return data as Notice;
}

export async function updateNotice(
  id: number,
  fields: Partial<Pick<Notice, "title" | "notice_date" | "tag" | "content">>
) {
  await supabase.from("notices").update(fields).eq("id", id);
}

export async function deleteNotice(id: number) {
  await supabase.from("notices").delete().eq("id", id);
}

// ============================================================
// class plans ("수업" 탭 — 진도/클리닉/과제, 클리닉 점검표와 동일한 class+week 구조)
// ============================================================

export async function getClassPlan(
  classKey: ClassKey,
  weekStart: Date
): Promise<ClassPlan | null> {
  const { data } = await supabase
    .from("class_plans")
    .select("*")
    .eq("class_key", classKey)
    .eq("week_start", toISODate(weekStart))
    .maybeSingle();
  return (data as ClassPlan) ?? null;
}

export async function upsertClassPlanField(
  classKey: ClassKey,
  weekStart: Date,
  field: "progress_content" | "clinic_content" | "homework_content",
  value: string
) {
  const existing = await getClassPlan(classKey, weekStart);
  await supabase.from("class_plans").upsert(
    {
      class_key: classKey,
      week_start: toISODate(weekStart),
      progress_content: existing?.progress_content ?? "",
      clinic_content: existing?.clinic_content ?? "",
      homework_content: existing?.homework_content ?? "",
      [field]: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "class_key,week_start" }
  );
}

// ============================================================
// calendar notes (학생/학부모 홈 하단 월 달력에 표시되는 날짜별 메모)
// ============================================================

export async function listCalendarNotesForRange(
  rangeStart: Date,
  rangeEnd: Date
): Promise<CalendarNote[]> {
  const { data } = await supabase
    .from("calendar_notes")
    .select("*")
    .lte("note_date", toISODate(rangeEnd))
    .gte("end_date", toISODate(rangeStart))
    .order("note_date");
  return (data as CalendarNote[]) ?? [];
}

export async function createCalendarNote(noteDate: Date, classKeys: ClassKey[] | null) {
  const iso = toISODate(noteDate);
  const { data } = await supabase
    .from("calendar_notes")
    .insert({ note_date: iso, end_date: iso, class_keys: classKeys, content: "" })
    .select("*")
    .single();
  return data as CalendarNote;
}

export async function updateCalendarNote(
  id: number,
  fields: Partial<{ note_date: string; end_date: string; class_keys: ClassKey[] | null; content: string }>
) {
  await supabase.from("calendar_notes").update(fields).eq("id", id);
}

export async function deleteCalendarNote(id: number) {
  await supabase.from("calendar_notes").delete().eq("id", id);
}

// ============================================================
// staff
// ============================================================

export async function listStaff(): Promise<Staff[]> {
  const { data } = await supabase.from("staff").select("*").order("id");
  return (data as Staff[]) ?? [];
}

export async function getStaffById(id: number): Promise<Staff | null> {
  const { data } = await supabase.from("staff").select("*").eq("id", id).maybeSingle();
  return (data as Staff) ?? null;
}

export async function createStaff(fields: {
  name: string;
  username: string;
  passwordHash: string;
}) {
  const { data } = await supabase
    .from("staff")
    .insert({
      name: fields.name,
      username: fields.username,
      password_hash: fields.passwordHash,
      work_days: [],
    })
    .select("*")
    .single();
  return data as Staff;
}

export async function updateStaff(
  id: number,
  fields: Partial<
    Pick<Staff, "name" | "work_days" | "work_time" | "work_period" | "note" | "username">
  > & { passwordHash?: string }
) {
  const { passwordHash, ...rest } = fields;
  const payload: Record<string, unknown> = { ...rest };
  if (passwordHash) payload.password_hash = passwordHash;
  await supabase.from("staff").update(payload).eq("id", id);
}

export async function deleteStaff(id: number) {
  await supabase.from("staff").delete().eq("id", id);
}

// ============================================================
// duty checklist
// ============================================================

export async function listDutyItems(): Promise<DutyItem[]> {
  const { data } = await supabase.from("duty_items").select("*").order("sort_order");
  return (data as DutyItem[]) ?? [];
}

export async function createDutyItem(label: string) {
  const items = await listDutyItems();
  const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) + 1 : 0;
  await supabase.from("duty_items").insert({ label, sort_order: nextOrder });
}

export async function updateDutyItem(id: number, label: string) {
  await supabase.from("duty_items").update({ label }).eq("id", id);
}

export async function deleteDutyItem(id: number) {
  await supabase.from("duty_items").delete().eq("id", id);
}

export async function getDutyChecksForStaffDate(
  staffId: number,
  date: Date
): Promise<Map<number, boolean>> {
  const { data } = await supabase
    .from("duty_checks")
    .select("item_id, checked")
    .eq("staff_id", staffId)
    .eq("check_date", toISODate(date));
  const map = new Map<number, boolean>();
  for (const row of (data as DutyCheck[]) ?? []) {
    map.set(row.item_id, row.checked);
  }
  return map;
}

/** All staff's duty checks for a given date, grouped by staff_id — used by
 * the 종주T home dashboard to show every TA's checklist progress at once. */
export async function getDutyChecksForDate(date: Date): Promise<Map<number, Map<number, boolean>>> {
  const { data } = await supabase
    .from("duty_checks")
    .select("staff_id, item_id, checked")
    .eq("check_date", toISODate(date));
  const map = new Map<number, Map<number, boolean>>();
  for (const row of (data as DutyCheck[]) ?? []) {
    if (!map.has(row.staff_id)) map.set(row.staff_id, new Map());
    map.get(row.staff_id)!.set(row.item_id, row.checked);
  }
  return map;
}

export async function toggleDutyCheck(
  staffId: number,
  itemId: number,
  date: Date,
  checked: boolean
) {
  await supabase.from("duty_checks").upsert(
    { staff_id: staffId, item_id: itemId, check_date: toISODate(date), checked },
    { onConflict: "staff_id,item_id,check_date" }
  );
}

/** 특정 날짜에 대타로 온 조교 목록(staff_id) — 종주T 홈 화면의 요일별
 * 현황에 원래 근무 요일과 무관하게 그날만 추가로 표시하기 위해 쓴다. */
export async function getDutySubstitutesForDates(dates: Date[]): Promise<Map<string, number[]>> {
  const isoDates = dates.map(toISODate);
  const map = new Map<string, number[]>();
  if (isoDates.length === 0) return map;
  const { data } = await supabase
    .from("duty_substitutes")
    .select("check_date, staff_id")
    .in("check_date", isoDates);
  for (const row of data ?? []) {
    const list = map.get(row.check_date) ?? [];
    list.push(row.staff_id);
    map.set(row.check_date, list);
  }
  return map;
}

export async function addDutySubstitute(date: Date, staffId: number) {
  await supabase
    .from("duty_substitutes")
    .upsert({ check_date: toISODate(date), staff_id: staffId }, { onConflict: "check_date,staff_id" });
}

export async function removeDutySubstitute(date: Date, staffId: number) {
  await supabase
    .from("duty_substitutes")
    .delete()
    .eq("check_date", toISODate(date))
    .eq("staff_id", staffId);
}

// ============================================================
// grades — 내신(school_exams) / 모의고사(mock_exams)
// ============================================================

export async function getSchoolExams(studentId: number): Promise<Map<string, SchoolExam>> {
  const { data } = await supabase.from("school_exams").select("*").eq("student_id", studentId);
  const map = new Map<string, SchoolExam>();
  for (const row of (data as SchoolExam[]) ?? []) map.set(row.exam_key, row);
  return map;
}

const SEMESTER_SUMMARY_EXAM_KEYS = SCHOOL_EXAMS.filter(
  (e): e is (typeof SCHOOL_EXAMS)[number] & { scoreless: true } => "scoreless" in e && e.scoreless
).map((e) => e.key);

/** 학기 종합(중간+기말 합산) 등급이 1등급인 학기 수를 학생별로 센다 —
 * 리더보드에서 닉네임 옆에 금별로 보여주는 데 쓴다(최대 5개: 1학년 1·2학기,
 * 2학년 1·2학기, 3학년 1학기 종합). */
export async function getSemesterTopGradeCounts(): Promise<Map<number, number>> {
  const { data } = await supabase
    .from("school_exams")
    .select("student_id")
    .in("exam_key", SEMESTER_SUMMARY_EXAM_KEYS)
    .eq("grade", 1);
  const map = new Map<number, number>();
  for (const row of (data as { student_id: number }[]) ?? []) {
    map.set(row.student_id, (map.get(row.student_id) ?? 0) + 1);
  }
  return map;
}

export async function upsertSchoolExam(
  studentId: number,
  examKey: string,
  fields: Partial<Pick<SchoolExam, "score" | "rank" | "grade" | "note">>
) {
  const { data: existing } = await supabase
    .from("school_exams")
    .select("score, rank, grade, note")
    .eq("student_id", studentId)
    .eq("exam_key", examKey)
    .maybeSingle();
  await supabase.from("school_exams").upsert(
    {
      student_id: studentId,
      exam_key: examKey,
      score: existing?.score ?? null,
      rank: existing?.rank ?? null,
      grade: existing?.grade ?? null,
      note: existing?.note ?? null,
      ...fields,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,exam_key" }
  );
}

export async function getMockExams(studentId: number): Promise<Map<string, MockExam>> {
  const { data } = await supabase.from("mock_exams").select("*").eq("student_id", studentId);
  const map = new Map<string, MockExam>();
  for (const row of (data as MockExam[]) ?? []) map.set(row.exam_key, row);
  return map;
}

export async function upsertMockExam(
  studentId: number,
  examKey: string,
  fields: Partial<Pick<MockExam, "score" | "percentile" | "grade" | "note">>
) {
  const { data: existing } = await supabase
    .from("mock_exams")
    .select("score, percentile, grade, note")
    .eq("student_id", studentId)
    .eq("exam_key", examKey)
    .maybeSingle();
  await supabase.from("mock_exams").upsert(
    {
      student_id: studentId,
      exam_key: examKey,
      score: existing?.score ?? null,
      percentile: existing?.percentile ?? null,
      grade: existing?.grade ?? null,
      note: existing?.note ?? null,
      ...fields,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,exam_key" }
  );
}

/**
 * 클리닉 테스트 백분위 추이 — 원점수는 매주 배점/난이도가 달라 비교할 수
 * 없으므로, 같은 반(class_key) 학생들과 같은 주에 본 시험별로 등수를 낸
 * 뒤 그 등수들의 평균으로 최종 순위를 재산출한다 (여러 시험을 본 주라도
 * 하나의 순위로 합산되도록). 그 주에 시험을 하나도 안 본(결석/불참) 학생은
 * 그 주 모집단에서 제외된다. `weeks`는 화면에 표시할 순서(보통 과거→최근)
 * 그대로 반환된다.
 */
export async function getClinicTestPercentileTrend(
  studentId: number,
  weeks: Date[]
): Promise<ClinicPercentilePoint[]> {
  const student = await getStudentById(studentId);
  const classKey = student?.class_key;
  if (!classKey) {
    return weeks.map((w) => ({
      label: weekLabel(w),
      value: null,
      grade: null,
      note: null,
      topPercent: null,
      rank: null,
      cohortSize: null,
    }));
  }

  const classmates = await listStudentsByClass(classKey);
  const classmateIds = classmates.map((s) => s.id);

  return Promise.all(
    weeks.map(async (weekStart): Promise<ClinicPercentilePoint> => {
      const label = weekLabel(weekStart);
      const checks = await getClinicChecksForStudents(classmateIds, weekStart);

      // Per test slot (0~3): rank every student who actually has a
      // score/total for that slot that week (competition ranking — ties
      // share the better rank).
      const ranksByStudent = new Map<number, number[]>();
      for (let slot = 0; slot < 4; slot++) {
        const entries: { studentId: number; pct: number }[] = [];
        for (const [sid, check] of checks) {
          const ts = check.test_scores?.[slot];
          const score = ts?.score !== undefined && ts.score !== "" ? Number(ts.score) : NaN;
          const total = ts?.total !== undefined && ts.total !== "" ? Number(ts.total) : NaN;
          if (!Number.isNaN(score) && !Number.isNaN(total) && total > 0) {
            entries.push({ studentId: sid, pct: score / total });
          }
        }
        for (const e of entries) {
          const rank = 1 + entries.filter((other) => other.pct > e.pct).length;
          const list = ranksByStudent.get(e.studentId) ?? [];
          list.push(rank);
          ranksByStudent.set(e.studentId, list);
        }
      }

      const avgRanks = Array.from(ranksByStudent.entries()).map(([sid, ranks]) => ({
        studentId: sid,
        avg: ranks.reduce((a, b) => a + b, 0) / ranks.length,
      }));
      const cohortSize = avgRanks.length;
      const mine = avgRanks.find((a) => a.studentId === studentId);

      if (cohortSize === 0 || !mine) {
        return { label, value: null, grade: null, note: null, topPercent: null, rank: null, cohortSize: null };
      }

      const rank = 1 + avgRanks.filter((a) => a.avg < mine.avg).length;
      const topPercent = Math.max(1, Math.round((rank / cohortSize) * 100));
      const value = cohortSize > 1 ? Math.round(((cohortSize - rank) / (cohortSize - 1)) * 100) : 100;
      const note = `${cohortSize}명 중 ${rank}등 (같은 주 시험 평균 순위 기준)`;

      return { label, value, grade: null, note, topPercent, rank, cohortSize };
    })
  );
}
