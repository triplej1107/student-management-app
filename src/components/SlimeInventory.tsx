"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEquipmentAction } from "@/app/student/slime/actions";
import {
  CATEGORY_LABELS,
  RARITY_LABELS,
  RARITY_STYLES,
  type InventoryItem,
  type ItemCategory,
} from "@/lib/slimeGachaTypes";

const SLOT_ORDER: ItemCategory[] = ["hat", "eyewear", "weapon", "shield", "background", "effect"];

/** 인벤토리 — 아이템을 누르면 착용/해제. 같은 부위는 하나만 착용된다. */
export function SlimeInventory({
  items,
  equipped,
}: {
  items: InventoryItem[];
  equipped: Record<string, string>; // slot → item code
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (item: InventoryItem) => {
    setError(null);
    const isOn = equipped[item.category] === item.code;
    startTransition(async () => {
      try {
        await setEquipmentAction(item.category, isOn ? null : item.inventoryId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "착용에 실패했어요.");
      }
    });
  };

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-line-soft bg-white p-4 text-center text-[13px] text-ink-muted/70">
        아직 아이템이 없어요 — 첫 뽑기를 해보세요!
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-4">
      <div className="mb-2 text-sm font-bold text-ink">
        인벤토리 <span className="text-xs font-normal text-ink-muted">({items.length}개 · 눌러서 착용)</span>
      </div>
      {error && <div className="mb-2 text-xs font-bold text-danger">{error}</div>}
      <div className="flex flex-col gap-3">
        {SLOT_ORDER.map((slot) => {
          const slotItems = items.filter((i) => i.category === slot);
          if (slotItems.length === 0) return null;
          return (
            <div key={slot}>
              <div className="mb-1 text-[11px] font-bold text-ink-muted">{CATEGORY_LABELS[slot]}</div>
              <div className="flex flex-wrap gap-1.5">
                {slotItems.map((item) => {
                  const isOn = equipped[item.category] === item.code;
                  return (
                    <button
                      key={item.inventoryId}
                      onClick={() => toggle(item)}
                      disabled={pending}
                      className={
                        "rounded-xl border px-2.5 py-1.5 text-left text-xs font-bold " +
                        RARITY_STYLES[item.rarity] +
                        (isOn ? " ring-2 ring-accent" : "")
                      }
                    >
                      <span className="block text-[10px] opacity-75">{RARITY_LABELS[item.rarity]}</span>
                      {item.name}
                      {isOn && <span className="ml-1 text-accent">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
