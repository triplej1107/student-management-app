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

/** 클리닉 출결/밀림 관리처럼 조교와 종주T가 함께 쓰는 화면용 — 종주T는
 * staff 테이블 row가 없어 staffId가 없을 수 있다 (그 경우 "누가 처리
 * 했는지" 기록이 null로 남는다). */
export async function requireStaffOrZongjuSession() {
  const session = await requireRole("staff", "zongju");
  return session as { role: Role; staffId?: number };
}
