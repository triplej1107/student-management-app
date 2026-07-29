import "server-only";
import { supabase } from "./supabase";
import { getStudentById, getClinicTemplate, getClinicCheck } from "./data";
import { isClinicFullyDone } from "./clinicProgress";
import { toISODate } from "./weeks";
import { UJC_EXCHANGE_UNITS, type UjcExchangeAmount } from "./types";

export const UJC_PER_CLINIC_WEEK = 1;
export { UJC_EXCHANGE_UNITS as EXCHANGE_UNITS };
export type ExchangeAmount = UjcExchangeAmount;

export type UjcReasonType = "clinic_complete" | "manual_grant" | "exchange" | "reset";

export interface UjcTransaction {
  id: number;
  student_id: number;
  amount: number;
  reason_type: UjcReasonType;
  reason_note: string | null;
  related_week_start: string | null;
  created_by: number | null;
  created_at: string;
}

export type ExchangeStatus = "pending" | "approved" | "rejected";

export interface UjcExchangeRequest {
  id: number;
  student_id: number;
  amount: number;
  status: ExchangeStatus;
  requested_at: string;
  resolved_by: number | null;
  resolved_at: string | null;
}

export async function getUjcBalance(studentId: number): Promise<number> {
  const { data } = await supabase.from("ujc_transactions").select("amount").eq("student_id", studentId);
  return (data ?? []).reduce((sum, r) => sum + r.amount, 0);
}

export async function getUjcHistory(studentId: number, limit = 50): Promise<UjcTransaction[]> {
  const { data } = await supabase
    .from("ujc_transactions")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as UjcTransaction[]) ?? [];
}

/**
 * 클리닉 주 완료 시 자동 적립 — (student_id, related_week_start) 부분
 * unique 인덱스가 중복 적립을 막아준다. insert 실패는 "이미 적립됨"
 * 뜻이므로 조용히 무시한다 (upsert를 쓰면 amount를 실수로 덮어쓸 수
 * 있어 insert-and-ignore-conflict 방식을 쓴다).
 */
export async function creditClinicCompletion(studentId: number, weekStart: Date, staffId?: number) {
  await supabase
    .from("ujc_transactions")
    .insert({
      student_id: studentId,
      amount: UJC_PER_CLINIC_WEEK,
      reason_type: "clinic_complete",
      related_week_start: toISODate(weekStart),
      created_by: staffId ?? null,
    })
    .select()
    .maybeSingle(); // 실패해도 던지지 않음 (unique 위반 = 이미 적립됨)
}

/** hw check/test score 저장 직후 호출 — 그 주가 방금 완료됐으면 적립. */
export async function maybeCreditClinicCompletion(
  studentId: number,
  weekStart: Date,
  staffId?: number
) {
  const student = await getStudentById(studentId);
  if (!student?.class_key) return;
  const [template, check] = await Promise.all([
    getClinicTemplate(student.class_key, weekStart),
    getClinicCheck(studentId, weekStart),
  ]);
  if (isClinicFullyDone(template ?? undefined, check ?? undefined)) {
    await creditClinicCompletion(studentId, weekStart, staffId);
  }
}

export async function grantManualUjc(
  studentId: number,
  amount: number,
  note: string,
  staffId?: number
) {
  await supabase.from("ujc_transactions").insert({
    student_id: studentId,
    amount,
    reason_type: "manual_grant",
    reason_note: note || null,
    created_by: staffId ?? null,
  });
}

/** 퇴원 시 잔고 0으로 리셋 — 실제 거래 이력은 지우지 않고 상쇄 트랜잭션을
 * 남긴다. */
export async function resetUjcBalance(studentId: number) {
  const balance = await getUjcBalance(studentId);
  if (balance === 0) return;
  await supabase.from("ujc_transactions").insert({
    student_id: studentId,
    amount: -balance,
    reason_type: "reset",
    reason_note: "퇴원으로 인한 잔고 초기화",
  });
}

export async function requestExchange(studentId: number, amount: ExchangeAmount) {
  const balance = await getUjcBalance(studentId);
  if (balance < amount) throw new Error("보유 UJC가 부족해요.");
  await supabase.from("ujc_exchange_requests").insert({ student_id: studentId, amount, status: "pending" });
}

export async function listPendingExchangeRequests(): Promise<
  (UjcExchangeRequest & { studentName: string; classKey: string | null })[]
> {
  const { data } = await supabase
    .from("ujc_exchange_requests")
    .select("*")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  const requests = (data as UjcExchangeRequest[]) ?? [];
  if (requests.length === 0) return [];

  const studentIds = [...new Set(requests.map((r) => r.student_id))];
  const { data: students } = await supabase.from("students").select("id, name, class_key").in("id", studentIds);
  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));

  return requests.map((r) => ({
    ...r,
    studentName: studentMap.get(r.student_id)?.name ?? "알 수 없음",
    classKey: studentMap.get(r.student_id)?.class_key ?? null,
  }));
}

export async function approveExchangeRequest(requestId: number, staffId?: number) {
  const { data: req } = await supabase
    .from("ujc_exchange_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!req || req.status !== "pending") throw new Error("이미 처리된 신청이에요.");

  const balance = await getUjcBalance(req.student_id);
  if (balance < req.amount) throw new Error("잔고가 부족해 승인할 수 없어요.");

  await supabase.from("ujc_transactions").insert({
    student_id: req.student_id,
    amount: -req.amount,
    reason_type: "exchange",
    reason_note: `UJC ${req.amount}개 교환 승인`,
    created_by: staffId ?? null,
  });
  await supabase
    .from("ujc_exchange_requests")
    .update({ status: "approved", resolved_by: staffId ?? null, resolved_at: new Date().toISOString() })
    .eq("id", requestId);
}

export async function rejectExchangeRequest(requestId: number, staffId?: number) {
  await supabase
    .from("ujc_exchange_requests")
    .update({ status: "rejected", resolved_by: staffId ?? null, resolved_at: new Date().toISOString() })
    .eq("id", requestId);
}
