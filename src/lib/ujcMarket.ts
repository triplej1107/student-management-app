import "server-only";
import { supabase } from "./supabase";
import type { UjcExchangeAmount, UjcMarketBrand, UjcMarketItem } from "./types";

export interface UjcMarketItemRow extends UjcMarketItem {
  active: boolean;
  sortOrder: number;
}

interface UjcMarketItemRecord {
  id: number;
  tier: number;
  brand: string;
  brand_label: string;
  price_value: number;
  active: boolean;
  sort_order: number;
}

function toItem(r: UjcMarketItemRecord): UjcMarketItemRow {
  return {
    id: r.id,
    tier: r.tier as UjcExchangeAmount,
    brand: r.brand as UjcMarketBrand,
    brandLabel: r.brand_label,
    priceValue: r.price_value,
    active: r.active,
    sortOrder: r.sort_order,
  };
}

/** 학생 마켓 화면용 — 활성화된 품목만, 정렬 순서대로. */
export async function listActiveUjcMarketItems(): Promise<UjcMarketItem[]> {
  const { data } = await supabase
    .from("ujc_market_items")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  return ((data as UjcMarketItemRecord[]) ?? []).map(toItem);
}

/** 관리자 화면용 — 비활성 품목도 포함해 전부. */
export async function listAllUjcMarketItems(): Promise<UjcMarketItemRow[]> {
  const { data } = await supabase.from("ujc_market_items").select("*").order("sort_order");
  return ((data as UjcMarketItemRecord[]) ?? []).map(toItem);
}

export async function createUjcMarketItem(
  tier: UjcExchangeAmount,
  brand: UjcMarketBrand,
  brandLabel: string,
  priceValue: number
) {
  const items = await listAllUjcMarketItems();
  const nextOrder = items.length > 0 ? Math.max(...items.map((i) => i.sortOrder)) + 1 : 0;
  await supabase.from("ujc_market_items").insert({
    tier,
    brand,
    brand_label: brandLabel,
    price_value: priceValue,
    sort_order: nextOrder,
  });
}

export async function updateUjcMarketItem(
  id: number,
  fields: Partial<{
    tier: UjcExchangeAmount;
    brand: UjcMarketBrand;
    brandLabel: string;
    priceValue: number;
    active: boolean;
  }>
) {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.tier !== undefined) update.tier = fields.tier;
  if (fields.brand !== undefined) update.brand = fields.brand;
  if (fields.brandLabel !== undefined) update.brand_label = fields.brandLabel;
  if (fields.priceValue !== undefined) update.price_value = fields.priceValue;
  if (fields.active !== undefined) update.active = fields.active;
  await supabase.from("ujc_market_items").update(update).eq("id", id);
}

export async function deleteUjcMarketItem(id: number) {
  await supabase.from("ujc_market_items").delete().eq("id", id);
}
