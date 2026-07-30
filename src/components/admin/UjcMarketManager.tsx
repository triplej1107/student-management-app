"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { UJC_EXCHANGE_UNITS, UJC_MARKET_BRANDS, type UjcExchangeAmount, type UjcMarketBrand } from "@/lib/types";
import type { UjcMarketItemRow } from "@/lib/ujcMarket";
import {
  createUjcMarketItemAction,
  updateUjcMarketItemAction,
  deleteUjcMarketItemAction,
} from "@/app/admin/ujc/actions";

function ItemRow({ item }: { item: UjcMarketItemRow }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState(String(item.priceValue));

  function commitPrice() {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) {
      setPrice(String(item.priceValue));
      return;
    }
    startTransition(async () => {
      await updateUjcMarketItemAction(item.id, { priceValue: Math.trunc(n) });
      showToast("저장됨");
      router.refresh();
    });
  }

  function changeBrand(brand: UjcMarketBrand) {
    const label = UJC_MARKET_BRANDS.find((b) => b.value === brand)?.label ?? brand;
    startTransition(async () => {
      await updateUjcMarketItemAction(item.id, { brand, brandLabel: label });
      showToast("저장됨");
      router.refresh();
    });
  }

  function toggleActive() {
    startTransition(async () => {
      await updateUjcMarketItemAction(item.id, { active: !item.active });
      showToast(item.active ? "비활성화됨" : "활성화됨");
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`${item.tier} UJC · ${item.brandLabel} 품목을 삭제할까요?`)) return;
    startTransition(async () => {
      await deleteUjcMarketItemAction(item.id);
      showToast("삭제됨");
      router.refresh();
    });
  }

  return (
    <div
      className={
        "flex items-center gap-1.5 rounded-lg border p-2 " +
        (item.active ? "border-line-soft bg-white" : "border-line-soft bg-bg-page opacity-60")
      }
    >
      <select
        value={item.brand}
        onChange={(e) => changeBrand(e.target.value as UjcMarketBrand)}
        disabled={pending}
        className="rounded-md border border-line bg-white px-1.5 py-1.5 text-xs"
      >
        {UJC_MARKET_BRANDS.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        onBlur={commitPrice}
        disabled={pending}
        inputMode="numeric"
        className="w-20 rounded-md border border-line px-1.5 py-1.5 text-xs"
      />
      <span className="text-[11px] text-ink-muted">원</span>
      <button
        onClick={toggleActive}
        disabled={pending}
        className={
          "ml-auto rounded-md border px-2 py-1 text-[11px] font-bold " +
          (item.active ? "border-line bg-white text-ink-secondary" : "border-accent bg-accent-soft text-accent")
        }
      >
        {item.active ? "노출중" : "숨김"}
      </button>
      <button onClick={remove} disabled={pending} className="text-[11px] font-bold text-danger">
        삭제
      </button>
    </div>
  );
}

function AddItemForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [tier, setTier] = useState<UjcExchangeAmount>(10);
  const [brand, setBrand] = useState<UjcMarketBrand>("GS25");
  const [price, setPrice] = useState("");

  function add() {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) {
      showToast("올바른 금액을 입력해주세요", "error");
      return;
    }
    const label = UJC_MARKET_BRANDS.find((b) => b.value === brand)?.label ?? brand;
    startTransition(async () => {
      await createUjcMarketItemAction(tier, brand, label, Math.trunc(n));
      setPrice("");
      showToast("품목 추가됨");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-ink-secondary/60 p-2">
      <select
        value={tier}
        onChange={(e) => setTier(Number(e.target.value) as UjcExchangeAmount)}
        className="rounded-md border border-line bg-white px-1.5 py-1.5 text-xs"
      >
        {UJC_EXCHANGE_UNITS.map((t) => (
          <option key={t} value={t}>
            {t} UJC
          </option>
        ))}
      </select>
      <select
        value={brand}
        onChange={(e) => setBrand(e.target.value as UjcMarketBrand)}
        className="rounded-md border border-line bg-white px-1.5 py-1.5 text-xs"
      >
        {UJC_MARKET_BRANDS.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="금액"
        inputMode="numeric"
        className="w-20 rounded-md border border-line px-1.5 py-1.5 text-xs"
      />
      <button
        onClick={add}
        disabled={pending}
        className="ml-auto rounded-md bg-accent px-2.5 py-1.5 text-[11px] font-bold text-white shadow-[0_1px_4px_rgba(20,30,60,0.10)] disabled:opacity-50"
      >
        추가
      </button>
    </div>
  );
}

export function UjcMarketManager({ items }: { items: UjcMarketItemRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      {UJC_EXCHANGE_UNITS.map((tier) => (
        <div key={tier}>
          <div className="mb-1.5 text-xs font-bold text-ink-muted">{tier} UJC</div>
          <div className="flex flex-col gap-1.5">
            {items
              .filter((i) => i.tier === tier)
              .map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
          </div>
        </div>
      ))}
      <div>
        <div className="mb-1.5 text-xs font-bold text-ink-muted">품목 추가</div>
        <AddItemForm />
      </div>
    </div>
  );
}
