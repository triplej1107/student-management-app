"use client";

import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import type { ParentQuestion } from "@/lib/types";

/** 학부모 홈 화면 전용 — 클리닉 점검표 요약 카드와 비슷한 크기 안에 담는
 * "종주T와 소통하기" 질문 칸. 질문 주(수요일 기준)가 바뀌면 initialQuestion이
 * null로 내려와 자동으로 빈 상태(리셋)가 된다. 답변이 달리면 질문 아래에
 * 그대로 노출하고 더 이상 수정할 수 없다. */
export function ParentQuestionCard({
  initialQuestion,
  submitAction,
}: {
  initialQuestion: ParentQuestion | null;
  submitAction: (text: string) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(initialQuestion?.question_text ?? "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setText(initialQuestion?.question_text ?? "");
    setDirty(false);
  }, [initialQuestion?.id, initialQuestion?.question_text]);

  function save() {
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await submitAction(trimmed);
      setDirty(false);
      showToast(initialQuestion ? "질문을 수정했어요" : "질문을 남겼어요");
    });
  }

  const answered = !!initialQuestion?.answer_text;

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-4 shadow-[0_3px_14px_rgba(20,30,60,0.12)]">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-ink-muted">종주T와 소통하기</div>
        <span
          className={
            "rounded-full px-2.5 py-1 text-[11px] font-bold " +
            (answered
              ? "bg-success-soft text-success"
              : initialQuestion
                ? "bg-warn-soft text-warn"
                : "bg-line-soft text-ink-muted")
          }
        >
          {answered ? "답변 완료" : initialQuestion ? "답변 대기중" : "질문 가능"}
        </span>
      </div>

      {answered ? (
        <>
          <div className="mt-2 rounded-xl bg-bg-page p-3 text-[13px] leading-relaxed text-ink-secondary">
            {initialQuestion!.question_text}
          </div>
          <div className="mt-2 rounded-xl bg-accent-soft p-3 text-[13px] leading-relaxed text-ink">
            <span className="font-bold text-accent">종주T ·</span> {initialQuestion!.answer_text}
          </div>
        </>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDirty(true);
            }}
            placeholder="궁금한 점을 편하게 남겨주세요. 매주 수요일 0시에 새로 초기화돼요."
            className="mt-2 min-h-[64px] w-full box-border rounded-xl border border-line px-3 py-2 text-[13px]"
          />
          <button
            onClick={save}
            disabled={!dirty || text.trim().length === 0}
            className="mt-2 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
          >
            {initialQuestion ? "질문 수정" : "질문 남기기"}
          </button>
        </>
      )}
    </div>
  );
}
