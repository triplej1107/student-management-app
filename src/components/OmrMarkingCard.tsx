"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { submitOmrAction } from "@/app/student/actions";
import { OMR_CHOICE_COUNT, type ClinicOmrSubmission } from "@/lib/types";

const CIRCLED = ["①", "②", "③", "④", "⑤"];

export function OmrMarkingCard({
  testIndex,
  label,
  answerCount,
  weights,
  weighted,
  submission,
}: {
  testIndex: number;
  label: string;
  answerCount: number;
  weights: number[];
  weighted: boolean;
  submission: ClinicOmrSubmission | null;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [answers, setAnswers] = useState<(string | null)[]>(
    Array.from({ length: answerCount }, () => null)
  );
  const [result, setResult] = useState(submission);

  if (answerCount === 0) {
    return (
      <div className="rounded-2xl border border-line-soft bg-white p-4 shadow-[0_3px_14px_rgba(20,30,60,0.12)]">
        <div className="text-sm font-bold text-ink">{label}</div>
        <div className="mt-1.5 text-[13px] text-ink-muted/70">아직 정답이 등록되지 않았어요.</div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-line-soft bg-white p-4 shadow-[0_3px_14px_rgba(20,30,60,0.12)]">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-ink">{label}</div>
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-bold text-success">
            제출 완료
          </span>
        </div>
        <div className="mt-2 text-[22px] font-extrabold text-ink">
          {weighted ? `${result.score}점/${result.total}점` : `${result.score}/${result.total}개 정답`}
        </div>
      </div>
    );
  }

  const allAnswered = answers.every((a) => a !== null);

  function submit() {
    startTransition(async () => {
      try {
        const finalAnswers = answers as string[];
        const { score, total } = await submitOmrAction(testIndex, finalAnswers);
        setResult({
          id: 0,
          student_id: 0,
          week_start: "",
          test_index: testIndex,
          round: 1,
          answers: finalAnswers,
          score,
          total,
          submitted_at: new Date().toISOString(),
        });
        showToast(weighted ? `채점 완료: ${score}점/${total}점!` : `채점 완료: ${score}/${total}개 정답!`);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "제출 중 오류가 발생했어요.", "error");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-4 shadow-[0_3px_14px_rgba(20,30,60,0.12)]">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-ink">{label}</div>
        <span className="text-xs text-ink-muted">
          {answers.filter((a) => a !== null).length}/{answerCount}문제 답변함
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
        {Array.from({ length: answerCount }, (_, qi) => (
          <div key={qi} className="flex items-center gap-1.5">
            <span className="w-11 text-xs font-semibold text-ink-muted">
              {qi + 1}
              {weighted && <span className="text-ink-muted/70"> ({weights[qi]}점)</span>}
            </span>
            <div className="flex flex-1 gap-1">
              {Array.from({ length: OMR_CHOICE_COUNT }, (_, ci) => {
                const choice = String(ci + 1);
                const selected = answers[qi] === choice;
                return (
                  <button
                    key={ci}
                    onClick={() =>
                      setAnswers((prev) => prev.map((a, i) => (i === qi ? choice : a)))
                    }
                    className={
                      "flex h-8 flex-1 items-center justify-center rounded-lg border text-sm font-bold " +
                      (selected
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-white text-ink-secondary")
                    }
                  >
                    {CIRCLED[ci]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={!allAnswered}
        className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
      >
        제출하기
      </button>
    </div>
  );
}
