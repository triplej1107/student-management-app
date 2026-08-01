import "server-only";
import { supabase } from "./supabase";
import type { Reminder, ReminderWithStudent } from "./types";

/** supabase 조인 결과({ students: { name } })를 평평한 studentName으로 편다. */
type JoinedRow = Reminder & { students?: { name: string } | null };
function withStudentName(row: JoinedRow): ReminderWithStudent {
  const { students, ...rest } = row;
  return { ...rest, studentName: students?.name ?? null };
}

const SELECT = "*, students(name)";

export async function listUpcomingReminders(): Promise<ReminderWithStudent[]> {
  const { data } = await supabase
    .from("reminders")
    .select(SELECT)
    .eq("resolved", false)
    .order("event_date")
    .order("event_time");
  return ((data as JoinedRow[]) ?? []).map(withStudentName);
}

export async function createReminder(
  eventDateISO: string,
  eventTime: string,
  content: string,
  studentId: number | null
) {
  await supabase.from("reminders").insert({
    event_date: eventDateISO,
    event_time: eventTime,
    content,
    student_id: studentId,
  });
}

/** 내용·날짜·시간·학생을 고친다. 알림을 아직 안 보낸 건이면 새 시각 기준으로
 * 다시 보내야 하므로 발송 표시를 지운다 — 날짜를 미뤘는데 "하루 전" 알림이
 * 이미 갔다고 표시돼 있으면 영영 안 가기 때문. */
export async function updateReminder(
  id: number,
  fields: { eventDateISO: string; eventTime: string; content: string; studentId: number | null }
) {
  await supabase
    .from("reminders")
    .update({
      event_date: fields.eventDateISO,
      event_time: fields.eventTime,
      content: fields.content,
      student_id: fields.studentId,
      day_before_pushed_at: null,
      hour_before_pushed_at: null,
    })
    .eq("id", id);
}

export async function deleteReminder(id: number) {
  await supabase.from("reminders").delete().eq("id", id);
}

export async function resolveReminder(id: number) {
  await supabase
    .from("reminders")
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq("id", id);
}

/** 오늘(event_date) 아직 해결 안 된 알림 — 조교/종주T 홈 화면 상단 배지용. */
export async function getTodayActiveReminders(todayISO: string): Promise<ReminderWithStudent[]> {
  const { data } = await supabase
    .from("reminders")
    .select(SELECT)
    .eq("event_date", todayISO)
    .eq("resolved", false)
    .order("event_time");
  return ((data as JoinedRow[]) ?? []).map(withStudentName);
}

/** 그 학생 본인에게 걸린, 오늘 이후의 아직 안 끝난 일정 — 학생 홈 화면용.
 * 지난 건은 굳이 계속 보여줄 필요가 없어 오늘부터만 본다. */
export async function getRemindersForStudent(
  studentId: number,
  todayISO: string
): Promise<Reminder[]> {
  const { data } = await supabase
    .from("reminders")
    .select("*")
    .eq("student_id", studentId)
    .eq("resolved", false)
    .gte("event_date", todayISO)
    .order("event_date")
    .order("event_time");
  return (data as Reminder[]) ?? [];
}

/** 내일이 event_date이고 아직 "하루 전" 푸시를 안 보낸 알림. */
export async function getRemindersDueForDayBeforePush(tomorrowISO: string): Promise<Reminder[]> {
  const { data } = await supabase
    .from("reminders")
    .select("*")
    .eq("event_date", tomorrowISO)
    .eq("resolved", false)
    .is("day_before_pushed_at", null);
  return (data as Reminder[]) ?? [];
}

export async function markDayBeforePushed(id: number) {
  await supabase.from("reminders").update({ day_before_pushed_at: new Date().toISOString() }).eq("id", id);
}

/** 오늘이 event_date이고 아직 "1시간 전" 푸시를 안 보낸 알림 후보 — 실제로
 * 지금이 그 시각 1시간 전쯤인지는 호출부(크론)에서 event_time과 비교해
 * 한 번 더 걸러낸다. */
export async function getRemindersDueForHourBeforePush(todayISO: string): Promise<Reminder[]> {
  const { data } = await supabase
    .from("reminders")
    .select("*")
    .eq("event_date", todayISO)
    .eq("resolved", false)
    .is("hour_before_pushed_at", null);
  return (data as Reminder[]) ?? [];
}

export async function markHourBeforePushed(id: number) {
  await supabase.from("reminders").update({ hour_before_pushed_at: new Date().toISOString() }).eq("id", id);
}
