import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import type { Role } from "./types";

/** Redirects to role-select if the session doesn't match one of `allowed`. */
export async function requireRole(...allowed: Role[]) {
  const session = await getSession();
  if (!session.role || !allowed.includes(session.role)) {
    redirect("/");
  }
  return session;
}

export async function requireStudentSession() {
  const session = await requireRole("student", "parent");
  if (!session.studentId) redirect("/");
  return session as { role: Role; studentId: number };
}

export async function requireStaffSession() {
  const session = await requireRole("staff");
  if (!session.staffId) redirect("/");
  return session as { role: Role; staffId: number };
}

export async function requireZongjuSession() {
  return requireRole("zongju");
}
