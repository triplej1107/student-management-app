"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import type { Reminder } from "@/lib/types";
import { createReminderAction, deleteReminderAction } from "@/app/admin/staff/reminders/actions";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function dayLabelForISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return DAY_LABELS[new Date(y, m - 1, d).getDay()];
}

function formatDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d} (${dayLabelForISO(iso)})`;
}

export function ReminderManager({ reminders }: { reminders: Reminder[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createReminderAction(date, time, content);
        setDate("");
        setTime("");
        setContent("");
        showToast("잊지마 항목이 추가됐어요");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "추가하지 못했어요.");
      }
    });
  }

  function remove(id: number) {
    if (!confirm("이 잊지마 항목을 삭제할까요?")) return;
    startTransition(async () => {
      await deleteReminderAction(id);
      showToast("삭제됐어요");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="rounded-2xl border border-line-soft bg-white p-3.5">
        <div className="mb-2 text-sm font-extrabold text-ink">새 잊지마 항목</div>
        <div className="flex gap-1.5">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
          />
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용 (예: 가락고1 신규 학부모 상담)"
          className="mt-1.5 min-h-[52px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
        />
        {error && <div className="mt-1.5 text-[11px] font-semibold text-danger">{error}</div>}
        <button
          onClick={submit}
          disabled={pending}
          className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
        >
          {pending ? "추가 중..." : "추가"}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {reminders.length === 0 && (
          <div className="text-[13px] text-ink-muted/70">등록된 잊지마 항목이 없어요.</div>
        )}
        {reminders.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-line-soft bg-white p-3"
          >
            <div className="min-w-0">
              <div className="text-xs font-bold text-ink">
                {formatDate(r.event_date)} {r.event_time}
              </div>
              <div className="mt-0.5 truncate text-[13px] text-ink-secondary">{r.content}</div>
            </div>
            <button
              onClick={() => remove(r.id)}
              className="flex-none rounded-lg border border-danger-soft bg-danger-soft px-2.5 py-1.5 text-[11px] font-bold text-danger"
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
