"use server";

import { revalidatePath } from "next/cache";
import { requireStaffOrZongjuSession } from "@/lib/authz";
import { toggleOnboardingCheck } from "@/lib/newStudents";

/** 조교·종주T 홈 화면의 신규 학생 체크리스트에서 호출 — 양쪽 다 체크할 수
 * 있어야 해서 공용 액션으로 뺐다("잊지마"의 resolveReminderAction과 같은 이유). */
export async function toggleOnboardingCheckAction(id: number, index: number, value: boolean) {
  await requireStaffOrZongjuSession();
  await toggleOnboardingCheck(id, index, value);
  revalidatePath("/staff");
  revalidatePath("/admin");
  revalidatePath("/admin/staff/new-students");
}
