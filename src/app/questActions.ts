"use server";

import { revalidatePath } from "next/cache";
import { requireStaffSession, requireZongjuSession } from "@/lib/authz";
import {
  ackQuest,
  completeQuest,
  createQuest,
  createQuestPreset,
  deleteQuest,
  deleteQuestPreset,
  markQuestFeedbackSeen,
  reviewQuest,
  updateQuestPreset,
} from "@/lib/quests";
import { getPushSubscriptionsForAllStaff, sendQuestPush } from "@/lib/clinicPush";

function revalidateAll() {
  revalidatePath("/staff");
  revalidatePath("/admin");
  revalidatePath("/admin/staff/quests");
}

export async function sendQuestAction(content: string) {
  await requireZongjuSession();
  const text = content.trim();
  if (!text) throw new Error("보낼 내용을 입력해주세요.");
  await createQuest(text);
  // 조교가 앱을 보고 있지 않아도 알 수 있게 — 밤에는 quietHours가 막는다.
  await sendQuestPush(await getPushSubscriptionsForAllStaff(), text);
  revalidateAll();
}

export async function deleteQuestAction(id: number) {
  await requireZongjuSession();
  await deleteQuest(id);
  revalidateAll();
}

export async function ackQuestAction(id: number) {
  const session = await requireStaffSession();
  await ackQuest(id, session.staffId);
  revalidateAll();
}

export async function completeQuestAction(id: number) {
  const session = await requireStaffSession();
  await completeQuest(id, session.staffId);
  revalidateAll();
}

/** 종주T가 완료 건을 처리 — 피드백이 비어 있으면 조교 화면엔 아무것도 안 뜬다. */
export async function reviewQuestAction(id: number, feedback: string) {
  await requireZongjuSession();
  await reviewQuest(id, feedback);
  revalidateAll();
}

export async function seeQuestFeedbackAction(id: number) {
  await requireStaffSession();
  await markQuestFeedbackSeen(id);
  revalidateAll();
}

export async function addQuestPresetAction(content: string) {
  await requireZongjuSession();
  const text = content.trim();
  if (!text) throw new Error("문구를 입력해주세요.");
  await createQuestPreset(text);
  revalidatePath("/admin/staff/quests");
}

export async function updateQuestPresetAction(id: number, content: string) {
  await requireZongjuSession();
  const text = content.trim();
  if (!text) throw new Error("문구를 입력해주세요.");
  await updateQuestPreset(id, text);
  revalidatePath("/admin/staff/quests");
}

export async function deleteQuestPresetAction(id: number) {
  await requireZongjuSession();
  await deleteQuestPreset(id);
  revalidatePath("/admin/staff/quests");
}
