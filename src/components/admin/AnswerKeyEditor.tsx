"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClassKey, ClinicAnswerKey } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { saveAnswerKeyAction } from "@/app/admin/exams/actions";

export function AnswerKeyEditor({
  classKey,
  weekStartISO,
  testLabels,
  answerKeys,
}: {
  classKey: ClassKey;
  weekStartISO: string;
  testLabels: string[];
  answerKeys: Record<number, ClinicAnswerKey>;
}) {
  const filledSlots = testLabels
    .map((label, i) => (label.trim() ? i : -1))
    .filter((i) => i >= 0);

  return (
    <div className="mt-[18px]">
      <div className="mb-2 text-[13px] font-bold text-ink">클리닉테스트 정답</div>
      {filledSlots.length === 0 && (
        <div className="text-[13px] text-ink-muted/70">
          이 반·주차엔 등록된 클리닉테스트가 없어요. 점검표 관리에서 먼저 테스트 칸을 입력해주세요.
        </div>
      )}
      <div className="flex flex-col gap-3">
        {filledSlots.map((i) => (
          <AnswerKeyRow
            key={i}
            classKey={classKey}
            weekStartISO={weekStartISO}
            testIndex={i}
            label={testLabels[i]}
            initialAnswers={answerKeys[i]?.answers ?? []}
            initialPoints={answerKeys[i]?.points ?? []}
          />
        ))}
      </div>
    </div>
  );
}

function AnswerKeyRow({
  classKey,
  weekStartISO,
  testIndex,
  label,
  initialAnswers,
  initialPoints,
}: {
  classKey: ClassKey;
  weekStartISO: string;
  testIndex: number;
  label: string;
  initialAnswers: string[];
  initialPoints: number[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [answers, setAnswers] = useState(initialAnswers.join(""));
  const [points, setPoints] = useState(initialPoints.join(""));

  function save() {
    startTransition(async () => {
      try {
        await saveAnswerKeyAction(classKey, weekStartISO, testIndex, answers, points);
        showToast("저장됨");
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "저장 중 오류가 발생했어요.", "error");
      }
    });
  }

  const questionCount = answers.replace(/[^0-9]/g, "").length;
  const pointCount = points.replace(/[^0-9]/g, "").length;
  const totalPoints = points
    .replace(/[^0-9]/g, "")
    .split("")
    .reduce((sum, d) => sum + Number(d), 0);

  return (
    <div className="rounded-[10px] border border-line-soft bg-white p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        <span className="text-xs text-ink-muted">문항 수: {questionCount}</span>
      </div>
      <textarea
        value={answers}
        onChange={(e) => setAnswers(e.target.value)}
        onBlur={save}
        placeholder="정답을 순서대로 이어붙여 입력 (예: 13245)"
        className="min-h-[52px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
      />
      <div className="mt-1.5 mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-muted">
          배점 (선택 — 모의고사처럼 문항마다 다르면 입력, 비워두면 문항당 1점)
        </span>
        {pointCount > 0 && <span className="text-xs text-ink-muted">총점: {totalPoints}</span>}
      </div>
      <textarea
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        onBlur={save}
        placeholder="문항별 배점을 순서대로 이어붙여 입력 (예: 22323232232323233332)"
        className="min-h-[44px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
      />
    </div>
  );
}
