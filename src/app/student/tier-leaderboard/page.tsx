import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/authz";
import { getStudentById } from "@/lib/data";
import { getTierLeaderboard } from "@/lib/ujcTier";
import { ScreenTitle, EmptyState } from "@/components/ui";

export default async function TierLeaderboardPage() {
  const session = await requireStudentSession();
  if (session.role !== "student") notFound(); // 학부모는 UJC 완전 비공개

  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const leaderboard = await getTierLeaderboard();

  return (
    <div className="box-border px-5 pt-2 pb-6">
      <ScreenTitle>성실도 리더보드</ScreenTitle>
      <div className="mt-1 text-xs text-ink-muted">
        클리닉 완료율과 테스트 백분위로 계산된 티어 점수 순위예요. 닉네임으로만 표시돼요.
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {leaderboard.length === 0 && <EmptyState>아직 등급이 산정된 학생이 없어요.</EmptyState>}
        {leaderboard.map((t, i) => {
          const isMe = t.studentId === student.id;
          return (
            <div
              key={t.studentId}
              className={
                "flex items-center justify-between rounded-2xl border p-3 " +
                (isMe ? "border-accent bg-accent-soft" : "border-line-soft bg-white")
              }
            >
              <div className="flex items-center gap-3">
                <div className="w-6 text-center text-sm font-extrabold text-ink-muted">{i + 1}</div>
                <div className="text-sm font-bold text-ink">
                  {t.nickname || t.name}
                  {isMe && <span className="ml-1 text-xs font-normal text-accent">(나)</span>}
                </div>
              </div>
              <div className="text-xs font-bold text-ink-secondary">{t.grade}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
