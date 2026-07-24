import "server-only";
import { supabase } from "./supabase";
import { toISODate } from "./weeks";
import { classKeyFor } from "./classKey";
import type {
  AttendanceStatus,
  ClassKey,
  ClinicCheck,
  ClinicTemplate,
  DutyCheck,
  DutyItem,
  MakeupSchedule,
  Notice,
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
  await supabase
    .from("students")
    .update({ ...fields, updated_at: new Date().toISOString() })
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
    .update({ enrolled, updated_at: new Date().toISOString() })
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
  makeupTime: string
) {
  await supabase.from("makeup_schedules").upsert(
    {
      student_id: studentId,
      session_date: toISODate(sessionDate),
      makeup_day: makeupDay,
      makeup_time: makeupTime,
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

/** Enrolled students whose *effective* clinic day (accounting for this
 * week's makeup schedule) equals `day`. */
export async function getRosterForDay(
  day: string,
  weekStart: Date,
  weekEnd: Date
): Promise<RosterEntry[]> {
  const [students, makeupMap] = await Promise.all([
    listStudents({ enrolledOnly: true }),
    getMakeupMapForWeek(weekStart, weekEnd),
  ]);

  return students
    .map((student) => {
      const makeup = makeupMap.get(student.id);
      const effDay = makeup?.makeup_day ?? student.clinic_day ?? "";
      const effTime = makeup?.makeup_time ?? student.clinic_time ?? "";
      return { student, effDay, effTime, hasMakeup: !!makeup, makeup };
    })
    .filter((entry) => entry.effDay === day);
}

/** Distinct effective clinic days among enrolled students this week, in
 * 월~일 order — used to render only the day tabs that actually have students. */
export async function getActiveClinicDays(
  weekStart: Date,
  weekEnd: Date
): Promise<string[]> {
  const [students, makeupMap] = await Promise.all([
    listStudents({ enrolledOnly: true }),
    getMakeupMapForWeek(weekStart, weekEnd),
  ]);
  const days = new Set<string>();
  for (const student of students) {
    const makeup = makeupMap.get(student.id);
    const effDay = makeup?.makeup_day ?? student.clinic_day;
    if (effDay) days.add(effDay);
  }
  const DAY_ORDER = ["월", "화", "수", "목", "금", "토", "일"];
  return DAY_ORDER.filter((d) => days.has(d));
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
  markedBy: number
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
