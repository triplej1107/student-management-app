"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  verifyStudentLogin,
  verifyParentLogin,
  verifyStaffLogin,
  verifyZongjuLogin,
} from "@/lib/auth";
import type { Role } from "@/lib/types";

export interface LoginFormState {
  error?: string;
}

function roleHome(role: Role) {
  if (role === "staff") return "/staff";
  if (role === "zongju") return "/admin";
  return "/student";
}

export async function loginAction(
  role: Role,
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const result =
    role === "student"
      ? await verifyStudentLogin(String(formData.get("id") ?? ""))
      : role === "parent"
        ? await verifyParentLogin(String(formData.get("id") ?? ""))
        : role === "staff"
          ? await verifyStaffLogin(
              String(formData.get("id") ?? ""),
              String(formData.get("password") ?? "")
            )
          : await verifyZongjuLogin(String(formData.get("password") ?? ""));

  if (!result.ok) {
    return { error: result.error };
  }

  const session = await getSession();
  session.role = role;
  if (result.studentId !== undefined) session.studentId = result.studentId;
  if (result.staffId !== undefined) session.staffId = result.staffId;
  await session.save();

  redirect(roleHome(role));
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
