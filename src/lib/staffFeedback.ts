import "server-only";
import { supabase } from "./supabase";

export interface StaffFeedbackMessage {
  id: number;
  staff_id: number;
  message: string;
  created_at: string;
  seen_at: string | null;
}

/** 종주T가 특정 조교에게 한마디를 남긴다. */
export async function sendStaffFeedback(staffId: number, message: string) {
  await supabase.from("staff_feedback_messages").insert({ staff_id: staffId, message });
}

/** 조교 홈 화면에서 아직 안 본 한마디 목록 — 로그인/새로고침마다 다시 뜬다. */
export async function getUnseenStaffFeedback(staffId: number): Promise<StaffFeedbackMessage[]> {
  const { data } = await supabase
    .from("staff_feedback_messages")
    .select("*")
    .eq("staff_id", staffId)
    .is("seen_at", null)
    .order("created_at");
  return (data as StaffFeedbackMessage[]) ?? [];
}

export async function markStaffFeedbackSeen(ids: number[]) {
  if (ids.length === 0) return;
  await supabase
    .from("staff_feedback_messages")
    .update({ seen_at: new Date().toISOString() })
    .in("id", ids);
}

/** 관리자(/admin/staff/feedback) 화면에서 그동안 보낸 한마디 이력을 본다. */
export async function listStaffFeedbackHistory(staffId: number, limit = 10): Promise<StaffFeedbackMessage[]> {
  const { data } = await supabase
    .from("staff_feedback_messages")
    .select("*")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as StaffFeedbackMessage[]) ?? [];
}
