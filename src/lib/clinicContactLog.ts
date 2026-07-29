import "server-only";
import { supabase } from "./supabase";
import { toISODate } from "./weeks";
import type { ClinicContactLog } from "./types";

export async function getClinicContactLogs(
  weekStart: Date,
  studentIds: number[]
): Promise<Map<number, ClinicContactLog>> {
  if (studentIds.length === 0) return new Map();
  const { data } = await supabase
    .from("clinic_contact_logs")
    .select("*")
    .in("student_id", studentIds)
    .eq("week_start", toISODate(weekStart));
  const map = new Map<number, ClinicContactLog>();
  for (const row of (data as ClinicContactLog[]) ?? []) map.set(row.student_id, row);
  return map;
}

export async function setClinicContact(
  studentId: number,
  weekStart: Date,
  fields: { contacted: boolean; note?: string; staffId?: number }
) {
  await supabase.from("clinic_contact_logs").upsert(
    {
      student_id: studentId,
      week_start: toISODate(weekStart),
      contacted: fields.contacted,
      ...(fields.note !== undefined ? { note: fields.note } : {}),
      contacted_by: fields.contacted ? (fields.staffId ?? null) : null,
      contacted_at: fields.contacted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,week_start" }
  );
}

export async function setClinicContactNote(studentId: number, weekStart: Date, note: string) {
  const { data: existing } = await supabase
    .from("clinic_contact_logs")
    .select("contacted, contacted_by, contacted_at")
    .eq("student_id", studentId)
    .eq("week_start", toISODate(weekStart))
    .maybeSingle();
  await supabase.from("clinic_contact_logs").upsert(
    {
      student_id: studentId,
      week_start: toISODate(weekStart),
      contacted: existing?.contacted ?? false,
      contacted_by: existing?.contacted_by ?? null,
      contacted_at: existing?.contacted_at ?? null,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,week_start" }
  );
}
