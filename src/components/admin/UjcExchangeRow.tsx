"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { completeExchangeAction, cancelExchangeAction } from "@/app/admin/ujc/actions";

export function UjcExchangeRow({
  requestId,
  studentName,
  classKey,
  amount,
  brandName,
  priceValue,
  requestedAt,
}: {
  requestId: number;
  studentName: string;
  classKey: string | null;
  amount: number;
  brandName: string | null;
  priceValue: number | null;
  requestedAt: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);

  function complete() {
    setPending(true);
    startTransition(async () => {
      try {
        await completeExchangeAction(requestId);
        showToast(`${studentName} 발송 완료 처리됨`);
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "처리 실패", "error");
      } finally {
        setPending(false);
      }
    });
  }

  function cancel() {
    const ok = window.confirm(`${studentName} 학생의 신청을 취소하고 UJC ${amount}개를 환불할까요?`);
    if (!ok) return;
    setPending(true);
    startTransition(async () => {
      try {
        await cancelExchangeAction(requestId);
        showToast("신청 취소 및 환불 완료");
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "취소 실패", "error");
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-line-soft bg-white p-3.5">
      <div>
        <div className="text-sm font-bold text-ink">
          {studentName} <span className="font-normal text-ink-muted">· {classKey ?? "미배정"}</span>
        </div>
        <div className="mt-0.5 text-xs text-ink-secondary">
          {brandName} {priceValue?.toLocaleString()}원권 · {amount} UJC
        </div>
        <div className="mt-0.5 text-xs text-ink-muted">
          신청일 {new Date(requestedAt).toLocaleDateString("ko-KR")}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={cancel}
          disabled={pending}
          className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
        >
          취소(환불)
        </button>
        <button
          onClick={complete}
          disabled={pending}
          className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
        >
          발송 완료
        </button>
      </div>
    </div>
  );
}
