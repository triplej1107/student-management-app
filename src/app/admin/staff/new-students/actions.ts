"use server";

import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { createOnboarding, deleteOnboarding } from "@/lib/newStudents";

function revalidateAll() {
  revalidatePath("/admin/staff/new-students");
  revalidatePath("/admin");
  revalidatePath("/staff");
}

export async function createOnboardingAction(name: string, school: string, grade: string) {
  await requireZongjuSession();
  if (!name.trim()) throw new Error("이름은 꼭 입력해주세요.");
  await createOnboarding(name.trim(), school.trim() || null, grade.trim() || null);
  revalidateAll();
}

export async function deleteOnboardingAction(id: number) {
  await requireZongjuSession();
  await deleteOnboarding(id);
  revalidateAll();
}
