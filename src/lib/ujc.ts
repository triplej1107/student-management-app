import "server-only";
import { supabase } from "./supabase";
import { getClinicCheck, listStudents } from "./data";
import { toISODate } from "./weeks";
import type { UjcExchangeAmount } from "./types";

export const UJC_PER_CLINIC_WEEK = 1;
type ExchangeAmount = UjcExchangeAmount;

export type UjcReasonType = "clinic_complete" | "manual_grant" | "exchange" | "reset" | "birthday_gift";

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

/** approved = "카카오톡으로 발송 완료", rejected = "취소(환불됨)". */
export type ExchangeStatus = "pending" | "approved" | "rejected";

export interface UjcExchangeRequest {
  id: number;
  student_id: number;
  amount: number;
  status: ExchangeStatus;
  brand_name: string | null;
  price_value: number | null;
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

export interface UjcBalanceLeaderboardRow {
  studentId: number;
  name: string;
  nickname: string | null;
  balance: number;
}

/** UJC 보유량 랭킹 — 성실도 티어와 달리 산정 유예 없이 재원생 전체를
 * 보유량 순으로 보여준다 (별개의 랭킹). */
export async function getUjcBalanceLeaderboard(): Promise<UjcBalanceLeaderboardRow[]> {
  const students = await listStudents({ enrolledOnly: true });
  const ids = students.map((s) => s.id);
  if (ids.length === 0) return [];

  const { data } = await supabase.from("ujc_transactions").select("student_id, amount").in("student_id", ids);
  const balances = new Map<number, number>();
  for (const row of data ?? []) {
    balances.set(row.student_id, (balances.get(row.student_id) ?? 0) + row.amount);
  }

  return students
    .map((s) => ({ studentId: s.id, name: s.name, nickname: s.nickname, balance: balances.get(s.id) ?? 0 }))
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance);
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

/** 종주T 최종 결재 토글 직후 호출 — 결재가 켜졌을 때만 적립한다.
 * (결재를 나중에 취소해도 이미 지급된 UJC는 회수하지 않음 — 결재
 * 취소는 드물고, 이미 받은 코인을 갑자기 뺏는 경험은 피하는 게 낫다.) */
export async function maybeCreditZongjuApproval(
  studentId: number,
  weekStart: Date,
  staffId?: number
) {
  const check = await getClinicCheck(studentId, weekStart);
  if (check?.zongju_approved) {
    await creditClinicCompletion(studentId, weekStart, staffId);
  }
}

/** 생일 축하 선물 — (student_id, related_week_start=그 해 생일 날짜) 부분
 * unique 인덱스가 매년 중복 지급을 막아준다. 반환값은 "이번 호출로 실제
 * 새로 지급됐는지"(true) / "이미 올해 지급됨"(false) — 호출부가 이 값으로
 * 알림 발송 여부를 결정한다. */
export async function grantBirthdayUjc(studentId: number, birthdayThisYearISO: string): Promise<boolean> {
  const { error } = await supabase.from("ujc_transactions").insert({
    student_id: studentId,
    amount: 1,
    reason_type: "birthday_gift",
    reason_note: "생일 축하 선물",
    related_week_start: birthdayThisYearISO,
  });
  return !error;
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

/**
 * UJC 마켓 교환 신청 — 신청과 동시에 코인이 차감된다 (기존 "신청만,
 * 승인 시점에 차감" 방식과 달리 마켓 스펙은 즉시 차감). request_ujc_exchange
 * Postgres 함수 안에서 "차감 트랜잭션 insert" + "신청 내역 insert"가
 * 하나의 트랜잭션으로 묶여 실행되므로 잔고 부족 등으로 실패하면 둘 다
 * 롤백된다.
 */
export async function requestMarketExchange(
  studentId: number,
  amount: ExchangeAmount,
  brandName: string,
  priceValue: number
): Promise<number> {
  const { data, error } = await supabase.rpc("request_ujc_exchange", {
    p_student_id: studentId,
    p_amount: amount,
    p_brand_name: brandName,
    p_price_value: priceValue,
  });
  if (error) {
    if (error.message?.includes("insufficient_balance")) {
      throw new Error("보유 UJC가 부족해요.");
    }
    throw new Error("교환 신청에 실패했어요.");
  }
  return data as number;
}

export async function getMyExchangeRequests(studentId: number, limit = 20): Promise<UjcExchangeRequest[]> {
  const { data } = await supabase
    .from("ujc_exchange_requests")
    .select("*")
    .eq("student_id", studentId)
    .order("requested_at", { ascending: false })
    .limit(limit);
  return (data as UjcExchangeRequest[]) ?? [];
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

/** 카카오톡 선물 발송 완료 처리 — 코인은 신청 시점에 이미 차감됐으므로
 * 여기서는 상태만 바꾼다. */
export async function completeExchangeRequest(requestId: number, staffId?: number) {
  const { data: req } = await supabase
    .from("ujc_exchange_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!req || req.status !== "pending") throw new Error("이미 처리된 신청이에요.");

  await supabase
    .from("ujc_exchange_requests")
    .update({ status: "approved", resolved_by: staffId ?? null, resolved_at: new Date().toISOString() })
    .eq("id", requestId);
}

/** 신청 취소 — 이미 차감된 코인을 환불한다. */
export async function cancelExchangeRequest(requestId: number, staffId?: number) {
  const { data: req } = await supabase
    .from("ujc_exchange_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (!req || req.status !== "pending") throw new Error("이미 처리된 신청이에요.");

  await supabase.from("ujc_transactions").insert({
    student_id: req.student_id,
    amount: req.amount,
    reason_type: "exchange",
    reason_note: `${req.brand_name ?? ""} 교환 취소 환불`.trim(),
    created_by: staffId ?? null,
  });
  await supabase
    .from("ujc_exchange_requests")
    .update({ status: "rejected", resolved_by: staffId ?? null, resolved_at: new Date().toISOString() })
    .eq("id", requestId);
}
