"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import type { ParentQuestionWithStudent } from "@/lib/parentQuestions";

function QuestionItem({
  question,
  answerAction,
}: {
  question: ParentQuestionWithStudent;
  answerAction: (id: number, answerText: string) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(question.answer_text ?? "");
  const [dirty, setDirty] = useState(false);
  const answered = !!question.answer_text;

  function save() {
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await answerAction(question.id, trimmed);
      setDirty(false);
      showToast("답변을 저장했어요");
    });
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-3.5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-ink">
          {question.studentName}
          {question.classTag && (
            <span className="text-xs font-normal text-ink-muted"> ({question.classTag})</span>
          )}
        </div>
        <span
          className={
            "rounded-full px-2.5 py-1 text-[11px] font-bold " +
            (answered ? "bg-success-soft text-success" : "bg-warn-soft text-warn")
          }
        >
          {answered ? "답변 완료" : "답변 대기중"}
        </span>
      </div>
      {question.schoolGrade && <div className="mt-0.5 text-xs text-ink-muted">{question.schoolGrade}</div>}

      <div className="mt-2 rounded-xl bg-bg-page p-2.5 text-[13px] leading-relaxed text-ink-secondary">
        {question.question_text}
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        placeholder="답변을 입력해주세요"
        className="mt-2 min-h-[64px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
      />
      <button
        onClick={save}
        disabled={!dirty || text.trim().length === 0}
        className="mt-2 w-full rounded-xl border border-accent bg-white px-4 py-2.5 text-sm font-bold text-accent shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:border-line disabled:text-ink-muted"
      >
        {answered ? "답변 수정" : "답변 등록"}
      </button>
    </div>
  );
}

/** 종주T 홈 화면 — 조교 업무 체크리스트 위에 배치되는 이번 질문 주의
 * 학부모 질문 목록. 미답변 질문이 먼저, 그 다음 답변 완료 순으로 보인다. */
export function ParentQuestionsSection({
  questions,
  answerAction,
}: {
  questions: ParentQuestionWithStudent[];
  answerAction: (id: number, answerText: string) => Promise<void>;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-sm font-bold text-ink">학부모 질문</div>
        <Link href="/admin/students/questions" className="text-xs font-bold text-accent">
          지난 내역 보기 →
        </Link>
      </div>
      {questions.length === 0 && (
        <div className="text-[13px] text-ink-muted/70">이번 주 남겨진 질문이 없어요.</div>
      )}
      <div className="flex flex-col gap-2">
        {questions.map((q) => (
          <QuestionItem key={q.id} question={q} answerAction={answerAction} />
        ))}
      </div>
    </div>
  );
}
