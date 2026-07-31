import type { QuestionAnalysis } from "@/lib/clinicOmr";

const CIRCLED = ["①", "②", "③", "④", "⑤"];

function circled(answer: string): string {
  const n = Number(answer);
  return Number.isInteger(n) && n >= 1 && n <= CIRCLED.length ? CIRCLED[n - 1] : answer;
}

/** OMR 마킹 데이터로 문항별 오답률과 "매력적인 오답"(오답 중 가장 많이 고른
 * 선택지)을 계산해, 테스트마다 오답률 상위 5문항을 보여준다. 학생들이 실제로
 * 마킹한 데이터가 쌓여야 의미가 생기므로, 제출자가 없으면 안내만 표시. */
export function OmrAnalysisPanel({
  testLabels,
  analysisBySlot,
}: {
  testLabels: string[];
  analysisBySlot: Record<number, QuestionAnalysis[]>;
}) {
  const filledSlots = testLabels.map((label, i) => (label.trim() ? i : -1)).filter((i) => i >= 0);
  if (filledSlots.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="mb-2 text-[13px] font-bold text-ink">오답 분석</div>
      <div className="mb-2 text-xs text-ink-muted">
        학생들의 OMR 마킹을 바탕으로 오답률이 높은 문항 5개와, 그 문항에서 학생들이 가장 많이 고른
        오답(매력적인 오답)을 보여줘요.
      </div>
      <div className="flex flex-col gap-3">
        {filledSlots.map((i) => {
          const rows = analysisBySlot[i] ?? [];
          return (
            <div key={i} className="rounded-[10px] border border-line-soft bg-white p-2.5">
              <div className="mb-1.5 text-[13px] font-semibold text-ink">{testLabels[i]}</div>
              {rows.length === 0 ? (
                <div className="text-xs text-ink-muted/70">
                  아직 제출한 학생이 없거나 정답이 등록되지 않았어요.
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {rows.map((r) => (
                    <div
                      key={r.questionIndex}
                      className="flex items-center justify-between rounded-lg bg-bg-page px-2.5 py-1.5 text-xs"
                    >
                      <div className="text-ink">
                        <span className="font-bold">{r.questionIndex + 1}번</span>
                        <span className="ml-1.5 text-ink-muted">정답 {circled(r.correctAnswer)}</span>
                      </div>
                      <div className="text-right">
                        <span
                          className={
                            "font-bold " +
                            (r.wrongRate >= 50
                              ? "text-danger"
                              : r.wrongRate >= 20
                                ? "text-warn"
                                : "text-ink-muted")
                          }
                        >
                          오답률 {r.wrongRate}%
                        </span>
                        <span className="ml-1.5 text-ink-muted">
                          ({r.submissionCount}명 중 {r.wrongCount}명)
                        </span>
                        {r.topWrongAnswer && (
                          <span className="ml-1.5 font-semibold text-warn">
                            매력적인 오답 {circled(r.topWrongAnswer)} ({r.topWrongCount}명)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
