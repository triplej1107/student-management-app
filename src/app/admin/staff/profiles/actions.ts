"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireZongjuSession } from "@/lib/authz";
import { createStaff, updateStaff, deleteStaff, getStaffById } from "@/lib/data";

export async function addStaffProfileAction() {
  await requireZongjuSession();
  const randomPassword = Math.random().toString(36).slice(-8);
  const passwordHash = await bcrypt.hash(randomPassword, 10);
  await createStaff({
    name: "새 조교",
    username: `staff${Date.now().toString().slice(-6)}`,
    passwordHash,
  });
  revalidatePath("/admin/staff/profiles");
}

export async function updateStaffFieldAction(
  staffId: number,
  field: "name" | "username" | "work_time" | "work_period" | "note",
  value: string
) {
  await requireZongjuSession();
  await updateStaff(staffId, { [field]: value });
  revalidatePath("/admin/staff/profiles");
}

export async function toggleStaffWorkDayAction(staffId: number, day: string) {
  await requireZongjuSession();
  const staff = await getStaffById(staffId);
  if (!staff) return;
  const days = staff.work_days.includes(day)
    ? staff.work_days.filter((d) => d !== day)
    : [...staff.work_days, day];
  await updateStaff(staffId, { work_days: days });
  revalidatePath("/admin/staff/profiles");
}

export async function setStaffPasswordAction(staffId: number, newPassword: string) {
  await requireZongjuSession();
  if (!newPassword.trim()) return;
  const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
  await updateStaff(staffId, { passwordHash });
  revalidatePath("/admin/staff/profiles");
}

export async function deleteStaffAction(staffId: number) {
  await requireZongjuSession();
  await deleteStaff(staffId);
  revalidatePath("/admin/staff/profiles");
}
