"use client";

import { useState, useTransition } from "react";
import { FEEDBACK_CATEGORIES, type FeedbackTags } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { saveFeedbackTagsAction, saveFeedbackTextAction } from "@/app/staff/clinic/actions";

export function FeedbackEditor({
  studentId,
  weekStartISO,
  initialTags,
  initialText,
}: {
  studentId: number;
  weekStartISO: string;
  initialTags: FeedbackTags | null;
  initialText: string | null;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [tags, setTags] = useState<FeedbackTags>(initialTags ?? {});
  const [text, setText] = useState(initialText ?? "");
  const [generating, setGenerating] = useState(false);
  const [dirty, setDirty] = useState(false);

  function toggleTag(categoryKey: string, option: string) {
    setTags((prev) => ({
      ...prev,
      [categoryKey]: prev[categoryKey as keyof FeedbackTags] === option ? undefined : option,
    }));
    setDirty(true);
  }

  async function generate() {
    if (Object.values(tags).every((v) => !v)) {
      showToast("태그를 먼저 선택해주세요", "error");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/feedback-generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tags, studentId, weekStartISO }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "생성 실패", "error");
        return;
      }
      setText(data.text);
      setDirty(true);
      showToast("피드백 생성됨 — 확인 후 저장해주세요");
    } catch {
      showToast("생성 실패", "error");
    } finally {
      setGenerating(false);
    }
  }

  function save() {
    startTransition(async () => {
      await Promise.all([
        saveFeedbackTagsAction(studentId, weekStartISO, tags),
        saveFeedbackTextAction(studentId, weekStartISO, text),
      ]);
      setDirty(false);
      showToast("저장됨");
    });
  }

  return (
    <div className="mt-[18px] border-t border-line-soft pt-[18px]">
      <div className="mb-2 text-[13px] font-bold text-ink">
        조교T의 피드백{" "}
        <span className="font-normal text-ink-muted">(저장 후 종주T 최종 결재가 나야 학부모에게 노출돼요)</span>
      </div>
      <div className="mb-2 text-[11px] text-ink-muted">
        모든 카테고리를 다 체크할 필요는 없어요. 어느 카테고리든 학생에게 꼭 해당하는 항목만 최소 1개 이상 선택해주세요.
      </div>
      <div className="flex flex-col gap-2">
        {FEEDBACK_CATEGORIES.map(({ key, label, options }) => (
          <div key={key}>
            <div className="mb-1 text-[11px] font-bold text-ink-muted">{label}</div>
            <div className="flex flex-wrap gap-1.5">
              {options.map((opt) => {
                const selected = tags[key as keyof FeedbackTags] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => toggleTag(key, opt)}
                    className={
                      "rounded-lg border px-2.5 py-1.5 text-xs font-bold shadow-[0_3px_14px_rgba(20,30,60,0.12)] " +
                      (selected
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line bg-white text-ink-secondary")
                    }
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={generate}
        disabled={generating}
        className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
      >
        {generating ? "생성 중..." : "AI로 피드백 생성"}
      </button>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        placeholder="생성된 피드백이 여기 표시돼요. 직접 수정도 가능해요."
        className="mt-2.5 min-h-[88px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
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
