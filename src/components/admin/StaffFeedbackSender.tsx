"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import type { StaffFeedbackMessage } from "@/lib/staffFeedback";

export function StaffFeedbackSender({
  staffId,
  staffName,
  history,
  sendAction,
}: {
  staffId: number;
  staffName: string;
  history: StaffFeedbackMessage[];
  sendAction: (staffId: number, message: string) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function send() {
    const trimmed = message.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await sendAction(staffId, trimmed);
      setMessage("");
      showToast(`${staffName}님에게 전달됨`);
    });
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold text-ink">{staffName}</div>
        {history.length > 0 && (
          <button onClick={() => setOpen((v) => !v)} className="text-xs font-bold text-accent">
            {open ? "이력 닫기" : `이력 보기 (${history.length})`}
          </button>
        )}
      </div>

      {open && (
        <div className="mb-2 flex flex-col gap-1.5">
          {history.map((h) => (
            <div key={h.id} className="rounded-lg bg-bg-page px-2.5 py-2 text-xs text-ink-secondary">
              <span className="text-ink-muted">{h.created_at.slice(0, 10)} · </span>
              {h.message}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="이 조교에게 남길 한마디"
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <button
          onClick={send}
          disabled={pending || !message.trim()}
          className="rounded-lg bg-accent px-3.5 py-2 text-xs font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
        >
          {pending ? "전송 중..." : "보내기"}
        </button>
      </div>
    </div>
  );
}
