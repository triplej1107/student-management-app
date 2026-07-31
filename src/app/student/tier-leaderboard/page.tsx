import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/authz";
import { getStudentById, getSemesterTopGradeCounts } from "@/lib/data";
import { getTierLeaderboard, TIER_GRADES_DESC } from "@/lib/ujcTier";
import { getUjcBalanceLeaderboard } from "@/lib/ujc";
import { ScreenTitle } from "@/components/ui";

function GoldStars({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="text-amber-500">{"★".repeat(count)}</span>;
}

export default async function TierLeaderboardPage() {
  const session = await requireStudentSession();
  if (session.role !== "student") notFound(); // 학부모는 UJC 완전 비공개

  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const [tierLeaderboard, ujcLeaderboard, goldStarCounts] = await Promise.all([
    getTierLeaderboard(),
    getUjcBalanceLeaderboard(),
    getSemesterTopGradeCounts(),
  ]);

  const gradeGroups = TIER_GRADES_DESC.map((grade) => ({
    grade,
    rows: tierLeaderboard.filter((t) => t.grade === grade),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="box-border px-5 pt-2 pb-6">
      <ScreenTitle>리더보드</ScreenTitle>
      <div className="mt-1 text-xs text-ink-muted">닉네임으로만 표시돼요.</div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div>
          <div className="mb-1.5 text-[13px] font-bold text-ink">UJC 보유량</div>
          <div className="flex flex-col gap-1.5">
            {ujcLeaderboard.length === 0 && (
              <div className="text-[11px] text-ink-muted/70">아직 데이터가 없어요.</div>
            )}
            {ujcLeaderboard.map((r, i) => {
              const isMe = r.studentId === student.id;
              return (
                <div
                  key={r.studentId}
                  className={
                    "flex items-center justify-between gap-1 rounded-xl border px-2 py-1.5 " +
                    (isMe ? "border-accent bg-accent-soft" : "border-line-soft bg-white")
                  }
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <div className="w-4 flex-none text-[11px] font-extrabold text-ink-muted">{i + 1}</div>
                    <div className="truncate text-xs font-bold text-ink">
                      {r.nickname || r.name}
                      {goldStarCounts.get(r.studentId) ? (
                        <span className="ml-1 text-[10px]">
                          <GoldStars count={goldStarCounts.get(r.studentId) ?? 0} />
                        </span>
                      ) : null}
                      {isMe && <span className="ml-0.5 text-[10px] font-normal text-accent">(나)</span>}
                    </div>
                  </div>
                  <div className="flex-none text-[11px] font-bold text-ink-secondary">{r.balance}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[13px] font-bold text-ink">성실도 티어</div>
          <div className="flex flex-col gap-2">
            {gradeGroups.length === 0 && (
              <div className="text-[11px] text-ink-muted/70">아직 등급이 산정된 학생이 없어요.</div>
            )}
            {gradeGroups.map(({ grade, rows }) => (
              <div key={grade}>
                <div className="mb-1 text-[11px] font-extrabold text-accent">
                  {grade} <span className="font-normal text-ink-muted">{rows.length}명</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {rows.map((r) => {
                    const isMe = r.studentId === student.id;
                    return (
                      <span
                        key={r.studentId}
                        className={
                          "rounded-full border px-1.5 py-0.5 text-[10px] font-bold " +
                          (isMe ? "border-accent bg-accent-soft text-accent" : "border-line-soft bg-white text-ink-secondary")
                        }
                      >
                        {r.nickname || r.name}
                        {goldStarCounts.get(r.studentId) ? (
                          <span className="ml-1">
                            <GoldStars count={goldStarCounts.get(r.studentId) ?? 0} />
                          </span>
                        ) : null}
                        {isMe && " (나)"}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
