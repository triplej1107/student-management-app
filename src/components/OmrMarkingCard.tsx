"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { submitOmrAction } from "@/app/student/actions";
import { OmrStartWarningModal } from "@/components/OmrStartWarningModal";
import { OMR_CHOICE_COUNT, type ClinicOmrSubmission } from "@/lib/types";
import { circled, type WrongAnswer } from "@/lib/omrReview";

const CIRCLED = ["①", "②", "③", "④", "⑤"];

export function OmrMarkingCard({
  testIndex,
  label,
  answerCount,
  weights,
  weighted,
  submission,
  wrong,
}: {
  testIndex: number;
  label: string;
  answerCount: number;
  weights: number[];
  weighted: boolean;
  submission: ClinicOmrSubmission | null;
  /** 이미 제출한 상태로 들어왔을 때의 오답 목록 (서버에서 계산해 넘어온다) */
  wrong: WrongAnswer[];
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [started, setStarted] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [answers, setAnswers] = useState<(string | null)[]>(
    Array.from({ length: answerCount }, () => null)
  );
  const [result, setResult] = useState(submission);
  const [wrongList, setWrongList] = useState(wrong);
  const answersRef = useRef(answers);
  const lockedRef = useRef(false);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // 시험을 시작한 뒤 화면을 벗어나면(다른 앱 전환·화면 잠금 등) 정답 검색을
  // 막기 위해 그 시점 답안으로 즉시 자동 제출·잠금시킨다.
  useEffect(() => {
    if (!started || result) return;

    function handleVisibility() {
      if (!document.hidden || lockedRef.current) return;
      lockedRef.current = true;
      const finalAnswers = answersRef.current.map((a) => a ?? "0");
      startTransition(async () => {
        try {
          const { score, total, wrong: w } = await submitOmrAction(testIndex, finalAnswers, true);
          setWrongList(w);
          setResult({
            id: 0,
            student_id: 0,
            week_start: "",
            test_index: testIndex,
            round: 1,
            answers: finalAnswers,
            score,
            total,
            left_app: true,
            submitted_at: new Date().toISOString(),
          });
        } catch {
          lockedRef.current = false;
        }
      });
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [started, result, testIndex, startTransition]);

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
          <span
            className={
              "rounded-full px-2.5 py-1 text-[11px] font-bold " +
              (result.left_app ? "bg-danger-soft text-danger" : "bg-success-soft text-success")
            }
          >
            {result.left_app ? "이탈로 자동 제출됨" : "제출 완료"}
          </span>
        </div>
        {/* 채점 결과보다 이게 먼저 눈에 들어와야 한다 — 점수부터 보면
            폰을 든 채로 계속 앉아 있게 된다. */}
        <div className="mt-3 rounded-xl bg-accent px-3 py-3 text-center">
          <div className="text-[17px] font-extrabold leading-snug text-white">
            📱 핸드폰을 데스크에 제출해주세요!
          </div>
        </div>

        <div className="mt-3 text-[22px] font-extrabold text-ink">
          {weighted ? `${result.score}점/${result.total}점` : `${result.score}/${result.total}개 정답`}
        </div>
        {result.left_app && (
          <div className="mt-1.5 text-xs text-danger">
            시험 중 화면을 벗어나 그 시점까지의 답안으로 자동 제출됐어요.
          </div>
        )}

        {wrongList.length === 0 ? (
          <div className="mt-2 text-[13px] font-bold text-success">전부 맞혔어요! 🎉</div>
        ) : (
          <div className="mt-3 border-t border-line-soft pt-3">
            <div className="mb-1.5 text-[13px] font-bold text-ink">
              틀린 문제 <span className="text-danger">{wrongList.length}개</span>
            </div>
            <div className="flex flex-col gap-1">
              {wrongList.map((w) => (
                <div
                  key={w.number}
                  className="flex items-center gap-2 rounded-lg bg-bg-page px-2.5 py-1.5 text-[13px]"
                >
                  <span className="w-9 flex-none font-extrabold text-ink">{w.number}번</span>
                  <span className="text-ink-secondary">
                    정답 <b className="text-success">{circled(w.correct)}</b>
                  </span>
                  <span className="text-ink-muted">·</span>
                  <span className="text-ink-secondary">
                    내 답 <b className="text-danger">{circled(w.chosen)}</b>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const totalPoints = weights.reduce((sum, w) => sum + w, 0);

  if (!started) {
    return (
      <div className="rounded-2xl border border-line-soft bg-white p-4 shadow-[0_3px_14px_rgba(20,30,60,0.12)]">
        <div className="text-sm font-bold text-ink">{label}</div>
        <div className="mt-1 text-xs text-ink-muted">
          {answerCount}문항{weighted && ` · ${totalPoints}점 만점`}
        </div>
        <button
          onClick={() => setShowWarning(true)}
          className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
        >
          응시하기
        </button>
        {showWarning && (
          <OmrStartWarningModal
            label={label}
            onCancel={() => setShowWarning(false)}
            onStart={() => {
              setShowWarning(false);
              setStarted(true);
            }}
          />
        )}
      </div>
    );
  }

  const allAnswered = answers.every((a) => a !== null);

  function submit() {
    lockedRef.current = true;
    startTransition(async () => {
      try {
        const finalAnswers = answers as string[];
        const { score, total, wrong: w } = await submitOmrAction(testIndex, finalAnswers);
        setWrongList(w);
        setResult({
          id: 0,
          student_id: 0,
          week_start: "",
          test_index: testIndex,
          round: 1,
          answers: finalAnswers,
          score,
          total,
          left_app: false,
          submitted_at: new Date().toISOString(),
        });
        showToast(weighted ? `채점 완료: ${score}점/${total}점!` : `채점 완료: ${score}/${total}개 정답!`);
      } catch (e) {
        lockedRef.current = false;
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
            <span className="w-9 text-xs font-semibold text-ink-muted">
              {qi + 1}
              {weighted && <span className="text-ink-muted/70"> ({weights[qi]})</span>}
            </span>
            <div className="flex flex-1 gap-1">
              {Array.from({ length: OMR_CHOICE_COUNT }, (_, ci) => {
                const choice = String(ci + 1);
                const selected = answers[qi] === choice;
                return (
                  <button
                    key={ci}
                    onClick={() =>
                      setAnswers((prev) =>
                        prev.map((a, i) => (i === qi ? (a === choice ? null : choice) : a))
                      )
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

      <div className="mt-2 text-center text-[11px] text-ink-muted/70">
        ⚠️ 화면을 벗어나면 그 시점 답안으로 자동 제출돼요.
      </div>
    </div>
  );
}
