"use server";

import { revalidatePath } from "next/cache";
import { requireStudentSession } from "@/lib/authz";
import { gachaPull, setEquipment } from "@/lib/slimeGacha";
import type { GachaResult, ItemCategory } from "@/lib/slimeGachaTypes";

function revalidateSlimePaths() {
  revalidatePath("/student/slime");
  revalidatePath("/student");
}

/** 뽑기 — 학생 본인만 (학부모 계정 불가). 결제·지급은 DB 함수가 원자적으로 처리. */
export async function gachaPullAction(): Promise<GachaResult> {
  const session = await requireStudentSession();
  if (session.role !== "student") throw new Error("학생 계정만 뽑기를 할 수 있어요.");
  const result = await gachaPull(session.studentId);
  revalidateSlimePaths();
  return result;
}

export async function setEquipmentAction(slot: ItemCategory, inventoryId: number | null) {
  const session = await requireStudentSession();
  if (session.role !== "student") throw new Error("학생 계정만 착용을 바꿀 수 있어요.");
  await setEquipment(session.studentId, slot, inventoryId);
  revalidateSlimePaths();
}
