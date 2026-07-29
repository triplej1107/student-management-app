"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { requestExchangeAction } from "@/app/student/actions";
import { UJC_EXCHANGE_UNITS, type UjcExchangeAmount } from "@/lib/types";

const TIER_STYLE: Record<string, string> = {
  그랜드마스터: "bg-[#FFF3D6] text-[#B76E00]",
  마스터: "bg-[#F0E7FF] text-[#7B3FE4]",
  다이아: "bg-[#E0F7FB] text-[#0E8AA8]",
  플래티넘: "bg-[#E5F3F5] text-[#3E7C8A]",
  골드: "bg-[#FFF6DD] text-[#B8860B]",
  실버: "bg-[#F1F2F4] text-[#6B7280]",
  브론즈: "bg-[#F5E6DA] text-[#9A5B32]",
};

export function UjcWalletCard({
  balance,
  grade,
}: {
  balance: number;
  grade: string | null;
}) {
  const [, startTransition] = useTransition();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  function exchange(amount: UjcExchangeAmount) {
    if (balance < amount) {
      showToast("보유 UJC가 부족해요", "error");
      return;
    }
    const ok = window.confirm(
      `UJC ${amount}개 교환을 신청할까요?\n데스크에서 실물 상품을 받으시면 승인 처리되며, 그때 잔고에서 차감돼요.`
    );
    if (!ok) return;
    setPending(true);
    startTransition(async () => {
      try {
        await requestExchangeAction(amount);
        showToast("교환 신청 완료 — 데스크에서 상품 받으시면 처리돼요");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "신청 실패", "error");
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-accent to-accent-hover p-4 text-white shadow-[0_3px_14px_rgba(20,30,60,0.15)]">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-white/80">보유 UJC</div>
        <span
          className={
            "rounded-full px-2.5 py-1 text-[11px] font-bold " +
            (grade ? (TIER_STYLE[grade] ?? "bg-white/20 text-white") : "bg-white/20 text-white")
          }
        >
          {grade ?? "등급 산정 중"}
        </span>
      </div>
      <div className="mt-1 text-[32px] font-extrabold">
        {balance} <span className="text-base font-bold">UJC</span>
      </div>

      <div className="mt-3 flex gap-1.5">
        {UJC_EXCHANGE_UNITS.map((amount) => (
          <button
            key={amount}
            onClick={() => exchange(amount)}
            disabled={pending || balance < amount}
            className="flex-1 rounded-xl bg-white/15 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {amount}개 교환
          </button>
        ))}
      </div>
    </div>
  );
}
