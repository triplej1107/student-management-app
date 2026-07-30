import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { markAppSeenInstalled } from "@/lib/data";

/** 학생/학부모 홈 화면이 standalone(설치된 상태)으로 열렸을 때만
 * 클라이언트가 호출하는 비콘 — 명단 관리에서 설치 여부 근사치로 쓴다. */
export async function POST() {
  const session = await getSession();
  if ((session.role === "student" || session.role === "parent") && session.studentId) {
    await markAppSeenInstalled(session.studentId, session.role);
  }
  return NextResponse.json({ ok: true });
}
