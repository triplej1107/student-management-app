import "server-only";
import { supabase } from "./supabase";
import { toISODate, weekLabel } from "./weeks";
import { classKeyFor } from "./classKey";
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

export async function listStudents(opts?: { enrolledOnly?: boolean }): Promise<Student[]> {
  let query = supabase.from("students").select("*").order("name");
  if (opts?.enrolledOnly) query = query.eq("enrolled", true);
  const { data } = await query;
  return (data as Student[]) ?? [];
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
    },
    { onConflict: "student_id,session_date" }
  );
}

export async function clearAttendance(studentId: number, date: Date) {
  await supabase
    .from("attendance_records")
    .delete()
    .eq("student_id", studentId)
    .eq("session_date", toISODate(date));
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
    .insert({ class_key: classKey, title: "", notice_date: toISODate(new Date()), tag: "", content: "" })
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

// ============================================================
// grades — 내신(school_exams) / 모의고사(mock_exams)
// ============================================================

export async function getSchoolExams(studentId: number): Promise<Map<string, SchoolExam>> {
  const { data } = await supabase.from("school_exams").select("*").eq("student_id", studentId);
  const map = new Map<string, SchoolExam>();
  for (const row of (data as SchoolExam[]) ?? []) map.set(row.exam_key, row);
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
