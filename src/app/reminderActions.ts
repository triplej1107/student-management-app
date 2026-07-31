"use server";

import { revalidatePath } from "next/cache";
import { requireStaffOrZongjuSession } from "@/lib/authz";
import { resolveReminder } from "@/lib/reminders";

/** 조교/종주T 홈 화면 상단 "잊지마" 배지에서 "예"를 누르면 호출 —
 * 양쪽 다 해결 처리할 수 있어야 해서 staff/zongju 공용 액션으로 뺐다. */
export async function resolveReminderAction(id: number) {
  await requireStaffOrZongjuSession();
  await resolveReminder(id);
  revalidatePath("/staff");
  revalidatePath("/admin");
}
