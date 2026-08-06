import "server-only";
import { supabase } from "./supabase";
import { questStage, isStaffVisible, isZongjuVisible, type QuestStage } from "./questStages";

export interface SurpriseQuest {
  id: number;
  content: string;
  created_at: string;
  acked_at: string | null;
  acked_by: number | null;
  done_at: string | null;
  done_by: number | null;
  feedback: string | null;
  reviewed_at: string | null;
  feedback_seen_at: string | null;
}

export interface QuestWithStage extends SurpriseQuest {
  stage: QuestStage;
  /** 완료한 조교 이름 — 종주T 화면에서 누가 했는지 보여준다. */
  doneByName: string | null;
}

export interface QuestPreset {
  id: number;
  content: string;
}

const COLUMNS =
  "id, content, created_at, acked_at, acked_by, done_at, done_by, feedback, reviewed_at, feedback_seen_at";

/** 아직 끝나지 않은 요청 전부 — 화면별 필터는 stage로 한다. */
async function listOpenQuests(): Promise<QuestWithStage[]> {
  const [{ data }, { data: staffRows }] = await Promise.all([
    supabase
      .from("surprise_quests")
      .select(COLUMNS)
      .is("feedback_seen_at", null)
      .order("created_at", { ascending: true }),
    supabase.from("staff").select("id, name"),
  ]);
  const nameById = new Map((staffRows as { id: number; name: string }[] ?? []).map((s) => [s.id, s.name]));
  return ((data as SurpriseQuest[]) ?? [])
    .map((q) => ({
      ...q,
      stage: questStage(q),
      doneByName: q.done_by ? nameById.get(q.done_by) ?? null : null,
    }))
    .filter((q) => q.stage !== "closed");
}

export async function getStaffQuests(): Promise<QuestWithStage[]> {
  return (await listOpenQuests()).filter((q) => isStaffVisible(q.stage));
}

export async function getZongjuQuests(): Promise<QuestWithStage[]> {
  return (await listOpenQuests()).filter((q) => isZongjuVisible(q.stage));
}

/** 종주T 관리 화면용 — 최근 것부터, 끝난 것까지 다 본다. */
export async function listRecentQuests(limit = 30): Promise<QuestWithStage[]> {
  const [{ data }, { data: staffRows }] = await Promise.all([
    supabase.from("surprise_quests").select(COLUMNS).order("created_at", { ascending: false }).limit(limit),
    supabase.from("staff").select("id, name"),
  ]);
  const nameById = new Map((staffRows as { id: number; name: string }[] ?? []).map((s) => [s.id, s.name]));
  return ((data as SurpriseQuest[]) ?? []).map((q) => ({
    ...q,
    stage: questStage(q),
    doneByName: q.done_by ? nameById.get(q.done_by) ?? null : null,
  }));
}

export async function createQuest(content: string) {
  await supabase.from("surprise_quests").insert({ content });
}

export async function deleteQuest(id: number) {
  await supabase.from("surprise_quests").delete().eq("id", id);
}

export async function ackQuest(id: number, staffId: number) {
  await supabase
    .from("surprise_quests")
    .update({ acked_at: new Date().toISOString(), acked_by: staffId })
    .eq("id", id)
    .is("acked_at", null);
}

export async function completeQuest(id: number, staffId: number) {
  const now = new Date().toISOString();
  // 확인을 건너뛰고 바로 완료를 눌렀어도 확인한 걸로 친다.
  const { data } = await supabase.from("surprise_quests").select("acked_at").eq("id", id).maybeSingle();
  await supabase
    .from("surprise_quests")
    .update({
      done_at: now,
      done_by: staffId,
      ...(data?.acked_at ? {} : { acked_at: now, acked_by: staffId }),
    })
    .eq("id", id);
}

/** 종주T가 완료 건을 처리 — 피드백을 쓰면 조교에게 다시 뜨고, 비우면 그대로 끝. */
export async function reviewQuest(id: number, feedback: string) {
  const trimmed = feedback.trim();
  await supabase
    .from("surprise_quests")
    .update({ feedback: trimmed || null, reviewed_at: new Date().toISOString() })
    .eq("id", id);
}

/** 조교가 피드백을 읽고 확인 — 여기서 완전히 끝난다. */
export async function markQuestFeedbackSeen(id: number) {
  await supabase
    .from("surprise_quests")
    .update({ feedback_seen_at: new Date().toISOString() })
    .eq("id", id);
}

// ============================================================
// 자주 쓰는 요청 문구
// ============================================================

export async function listQuestPresets(): Promise<QuestPreset[]> {
  const { data } = await supabase
    .from("quest_presets")
    .select("id, content")
    .order("created_at", { ascending: true });
  return (data as QuestPreset[]) ?? [];
}

export async function createQuestPreset(content: string) {
  await supabase.from("quest_presets").insert({ content });
}

export async function deleteQuestPreset(id: number) {
  await supabase.from("quest_presets").delete().eq("id", id);
}
