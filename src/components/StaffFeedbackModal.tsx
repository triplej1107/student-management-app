"use client";

import { useTransition } from "react";
import type { StaffFeedbackMessage } from "@/lib/staffFeedback";

export function StaffFeedbackModal({
  messages,
  onDismiss,
  markSeenAction,
}: {
  messages: StaffFeedbackMessage[];
  onDismiss: () => void;
  markSeenAction: (ids: number[]) => Promise<void>;
}) {
  const [, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      await markSeenAction(messages.map((m) => m.id));
    });
    onDismiss();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <div className="text-base font-extrabold text-ink">📣 종주T의 한마디</div>
        <div className="mt-3 flex flex-col gap-2">
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl border border-line-soft bg-bg-page p-3 text-sm text-ink-secondary">
              {m.message}
            </div>
          ))}
        </div>
        <button
          onClick={dismiss}
          className="mt-4 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
        >
          확인
        </button>
      </div>
    </div>
  );
}
