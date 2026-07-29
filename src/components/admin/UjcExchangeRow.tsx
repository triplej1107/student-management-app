"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { approveExchangeAction, rejectExchangeAction } from "@/app/admin/ujc/actions";

export function UjcExchangeRow({
  requestId,
  studentName,
  classKey,
  amount,
  requestedAt,
}: {
  requestId: number;
  studentName: string;
  classKey: string | null;
  amount: number;
  requestedAt: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);

  function approve() {
    setPending(true);
    startTransition(async () => {
      try {
        await approveExchangeAction(requestId);
        showToast(`${studentName} 교환 승인됨 (-${amount} UJC)`);
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "승인 실패", "error");
      } finally {
        setPending(false);
      }
    });
  }

  function reject() {
    setPending(true);
    startTransition(async () => {
      await rejectExchangeAction(requestId);
      showToast("교환 신청 거절됨");
      router.refresh();
      setPending(false);
    });
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-line-soft bg-white p-3.5">
      <div>
        <div className="text-sm font-bold text-ink">
          {studentName} <span className="font-normal text-ink-muted">· {classKey ?? "미배정"}</span>
        </div>
        <div className="mt-0.5 text-xs text-ink-muted">
          UJC {amount}개 교환 신청 · {new Date(requestedAt).toLocaleDateString("ko-KR")}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={reject}
          disabled={pending}
          className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-secondary disabled:opacity-50"
        >
          거절
        </button>
        <button
          onClick={approve}
          disabled={pending}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          승인
        </button>
      </div>
    </div>
  );
}
