"use server";

import { requireStudentSession } from "@/lib/authz";
import { markStudentTabSeen, STUDENT_TABS_WITH_DOT, type StudentTabKey } from "@/lib/tabUpdates";

/** 학생·학부모가 실제로 그 탭 화면을 열었을 때 호출 — 하단 탭의 "새 소식"
 * 점을 끈다. 서버 렌더링 중이 아니라 브라우저에서 화면이 뜬 뒤에 부르는 게
 * 중요하다: Next.js가 링크를 미리 불러오는(prefetch) 것만으로 읽음 처리되면
 * 보지도 않은 소식이 사라진다. */
export async function markTabSeenAction(tab: string) {
  const session = await requireStudentSession();
  if (!(STUDENT_TABS_WITH_DOT as readonly string[]).includes(tab)) return;
  await markStudentTabSeen(session.studentId, session.role ?? "student", tab as StudentTabKey);
}
