import { requireZongjuSession } from "@/lib/authz";
import { getSemesterTopGradeCounts } from "@/lib/data";
import { getTierLeaderboard, TIER_GRADES_DESC } from "@/lib/ujcTier";
import { getUjcBalanceLeaderboard } from "@/lib/ujc";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { STUDENT_SUB_TABS } from "../subTabs";

function GoldStars({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="text-amber-500">{"★".repeat(count)}</span>;
}

function displayName(name: string, nickname: string | null) {
  return nickname ? `${name} (${nickname})` : name;
}

export default async function AdminLeaderboardPage() {
  await requireZongjuSession();

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
    <div>
      <AdminSubNav tabs={STUDENT_SUB_TABS} />

      <div className="mt-4 text-[19px] font-extrabold text-ink">학생 순위</div>
      <div className="mt-1 text-xs text-ink-muted">
        학생 화면의 리더보드와 같은 정보예요. 여기서는 이름도 함께 보여요.
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div>
          <div className="mb-1.5 text-[13px] font-bold text-ink">UJC 보유량</div>
          <div className="flex flex-col gap-1.5">
            {ujcLeaderboard.length === 0 && (
              <div className="text-[11px] text-ink-muted/70">아직 데이터가 없어요.</div>
            )}
            {ujcLeaderboard.map((r, i) => (
              <div
                key={r.studentId}
                className="flex items-center justify-between gap-1 rounded-xl border border-line-soft bg-white px-2 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <div className="w-4 flex-none text-[11px] font-extrabold text-ink-muted">{i + 1}</div>
                  <div className="truncate text-xs font-bold text-ink">
                    {displayName(r.name, r.nickname)}
                    {goldStarCounts.get(r.studentId) ? (
                      <span className="ml-1 text-[10px]">
                        <GoldStars count={goldStarCounts.get(r.studentId) ?? 0} />
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex-none text-[11px] font-bold text-ink-secondary">{r.balance}</div>
              </div>
            ))}
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
                  {rows.map((r) => (
                    <span
                      key={r.studentId}
                      className="rounded-full border border-line-soft bg-white px-1.5 py-0.5 text-[10px] font-bold text-ink-secondary"
                    >
                      {displayName(r.name, r.nickname)}
                      {goldStarCounts.get(r.studentId) ? (
                        <span className="ml-1">
                          <GoldStars count={goldStarCounts.get(r.studentId) ?? 0} />
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
