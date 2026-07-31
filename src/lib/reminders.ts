import "server-only";
import { supabase } from "./supabase";
import type { Reminder } from "./types";

export async function listUpcomingReminders(): Promise<Reminder[]> {
  const { data } = await supabase
    .from("reminders")
    .select("*")
    .eq("resolved", false)
    .order("event_date")
    .order("event_time");
  return (data as Reminder[]) ?? [];
}

export async function createReminder(eventDateISO: string, eventTime: string, content: string) {
  await supabase.from("reminders").insert({ event_date: eventDateISO, event_time: eventTime, content });
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
export async function getTodayActiveReminders(todayISO: string): Promise<Reminder[]> {
  const { data } = await supabase
    .from("reminders")
    .select("*")
    .eq("event_date", todayISO)
    .eq("resolved", false)
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
