"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gachaPullAction } from "@/app/student/slime/actions";
import { CATEGORY_LABELS, RARITY_LABELS, RARITY_STYLES, type GachaResult } from "@/lib/slimeGachaTypes";

/** 뽑기 버튼 + 결과 공개 모달. 잔고 표시는 서버에서 내려준 값 기준이고,
 * 실제 차감·지급은 서버 DB 함수가 원자적으로 처리한다. */
export function SlimeGachaPanel({
  ujc,
  tickets,
  shards,
}: {
  ujc: number;
  tickets: number;
  shards: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<GachaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPull = tickets > 0 || ujc >= 1;
  const costLabel = tickets > 0 ? "뽑기권 1장" : "1 UJC";

  const pull = () => {
    setError(null);
    startTransition(async () => {
      try {
        const r = await gachaPullAction();
        setResult(r);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "뽑기에 실패했어요.");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-ink">아이템 뽑기</div>
        <div className="flex gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-accent-soft px-2 py-1 text-accent">뽑기권 {tickets}</span>
          <span className="rounded-full bg-line-soft px-2 py-1 text-ink-secondary">조각 {shards}/10</span>
          <span className="rounded-full bg-line-soft px-2 py-1 text-ink-secondary">UJC {ujc}</span>
        </div>
      </div>
      <div className="mt-1 text-[11px] text-ink-muted">
        일반 50% · 매직 30% · 레어 15% · 유니크 4% · 레전더리 1% — 20회 안에 유니크 이상 확정
      </div>
      <button
        onClick={pull}
        disabled={!canPull || pending}
        className={
          "mt-3 w-full rounded-xl py-3 text-sm font-bold shadow-[0_1px_4px_rgba(20,30,60,0.10)] " +
          (canPull && !pending
            ? "bg-accent text-white"
            : "bg-line-soft text-ink-muted")
        }
      >
        {pending ? "뽑는 중..." : canPull ? `뽑기 — ${costLabel}` : "UJC나 뽑기권이 필요해요"}
      </button>
      {error && <div className="mt-2 text-center text-xs font-bold text-danger">{error}</div>}

      {result && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-8"
          onClick={() => setResult(null)}
        >
          <div
            className={"w-full max-w-xs rounded-2xl border-2 p-5 text-center " + RARITY_STYLES[result.rarity]}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-bold opacity-80">
              {RARITY_LABELS[result.rarity]}
              {result.rarity === "legendary" && " ✦ 1%의 기적!"}
              {result.rarity === "unique" && " ✦"}
            </div>
            <div className="mt-1 text-xl font-extrabold">{result.itemName}</div>
            <div className="mt-0.5 text-xs opacity-80">{CATEGORY_LABELS[result.category]} 장비</div>
            {result.dupe ? (
              <div className="mt-3 rounded-xl bg-white/60 px-3 py-2 text-xs font-bold">
                이미 가진 아이템! 조각 +3
                {result.shardConverted
                  ? " — 조각 10개가 모여 뽑기권 1장이 됐어요!"
                  : ` (보유 ${result.shards}/10)`}
              </div>
            ) : (
              <div className="mt-3 text-xs font-bold">인벤토리에 추가됐어요 — 바로 착용해보세요!</div>
            )}
            <button
              onClick={() => setResult(null)}
              className="mt-4 w-full rounded-xl bg-white/70 py-2.5 text-sm font-bold"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
