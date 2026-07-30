"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { saveZongjuFeedbackAction } from "@/app/admin/students/approvals/actions";

export function ZongjuFeedbackEditor({
  studentId,
  weekStartISO,
  initialText,
}: {
  studentId: number;
  weekStartISO: string;
  initialText: string | null;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [text, setText] = useState(initialText ?? "");
  const [dirty, setDirty] = useState(false);

  function save() {
    startTransition(async () => {
      await saveZongjuFeedbackAction(studentId, weekStartISO, text);
      setDirty(false);
      showToast("저장됨");
    });
  }

  return (
    <div className="mt-[18px] border-t border-line-soft pt-[18px]">
      <div className="mb-2 text-[13px] font-bold text-ink">
        종주T의 피드백{" "}
        <span className="font-normal text-ink-muted">(작성할 때만 학부모에게 특별하게 노출돼요 · 선택)</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        placeholder="이번 주 이 학생에게 특별히 남기고 싶은 말이 있으면 적어주세요"
        className="min-h-[72px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
      />
      <button
        onClick={save}
        disabled={!dirty}
        className="mt-2 w-full rounded-xl border border-accent bg-white px-4 py-2.5 text-sm font-bold text-accent shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:border-line disabled:text-ink-muted"
      >
        저장
      </button>
    </div>
  );
}
