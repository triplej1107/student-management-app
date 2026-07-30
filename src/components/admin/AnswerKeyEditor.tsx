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
}: {
  classKey: ClassKey;
  weekStartISO: string;
  testIndex: number;
  label: string;
  initialAnswers: string[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(initialAnswers.join(""));

  function save() {
    startTransition(async () => {
      try {
        await saveAnswerKeyAction(classKey, weekStartISO, testIndex, value);
        showToast("저장됨");
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "저장 중 오류가 발생했어요.", "error");
      }
    });
  }

  const questionCount = value.replace(/[^0-9]/g, "").length;

  return (
    <div className="rounded-[10px] border border-line-soft bg-white p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
        <span className="text-xs text-ink-muted">문항 수: {questionCount}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder="정답을 순서대로 이어붙여 입력 (예: 13245)"
        className="min-h-[52px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
      />
    </div>
  );
}
