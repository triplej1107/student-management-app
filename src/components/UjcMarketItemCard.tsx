"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { UjcBrandBadge } from "@/components/UjcBrandBadge";
import { requestMarketExchangeAction } from "@/app/student/actions";
import type { UjcMarketItem } from "@/lib/types";

export function UjcMarketItemCard({ item, balance }: { item: UjcMarketItem; balance: number }) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);

  function exchange() {
    if (balance < item.tier) {
      showToast("UJC가 부족합니다. 클리닉을 완료하고 코인을 모아보세요!", "error");
      return;
    }
    const ok = window.confirm(
      "해당 금액권을 교환하시겠습니까?\n확인 버튼을 누르면 즉시 코인이 차감되며, 선생님이 확인 후 카카오톡으로 선물을 보내주십니다."
    );
    if (!ok) return;
    setPending(true);
    startTransition(async () => {
      try {
        await requestMarketExchangeAction(item.tier, item.brandLabel, item.priceValue);
        showToast("교환 신청 완료! 신청 내역에서 확인할 수 있어요.");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "신청 실패", "error");
      } finally {
        setPending(false);
      }
    });
  }

  const affordable = balance >= item.tier;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line-soft bg-white p-3">
      <UjcBrandBadge brand={item.brand} />
      <div className="flex-1">
        <div className="text-sm font-bold text-ink">{item.brandLabel}</div>
        <div className="text-xs text-ink-muted">{item.priceValue.toLocaleString()}원권</div>
      </div>
      <button
        onClick={exchange}
        disabled={pending}
        className={
          "rounded-full px-3.5 py-2 text-xs font-bold shadow-[0_1px_4px_rgba(20,30,60,0.10)] disabled:opacity-50 " +
          (affordable ? "bg-accent text-white" : "bg-line-soft text-ink-muted")
        }
      >
        {item.tier} UJC
      </button>
    </div>
  );
}
