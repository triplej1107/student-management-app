// 뽑기·인벤토리 공용 타입 — 클라이언트 컴포넌트에서도 import하므로 server-only 금지.

export type ItemRarity = "common" | "magic" | "rare" | "unique" | "legendary";
export type ItemCategory = "weapon" | "shield" | "hat" | "eyewear" | "background" | "effect";

export const RARITY_LABELS: Record<ItemRarity, string> = {
  common: "일반",
  magic: "매직",
  rare: "레어",
  unique: "유니크",
  legendary: "레전더리",
};

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  weapon: "오른손",
  shield: "왼손",
  hat: "머리",
  eyewear: "눈",
  background: "배경",
  effect: "이펙트",
};

/** 등급별 강조 색 (테두리/배경/글자) — 레전더리가 제일 눈에 띄어야 한다. */
export const RARITY_STYLES: Record<ItemRarity, string> = {
  common: "border-line bg-white text-ink-secondary",
  magic: "border-sky-300 bg-sky-50 text-sky-700",
  rare: "border-violet-300 bg-violet-50 text-violet-700",
  unique: "border-amber-300 bg-amber-50 text-amber-700",
  legendary: "border-red-400 bg-gradient-to-b from-amber-50 to-red-50 text-red-600",
};

export interface GachaResult {
  itemCode: string;
  itemName: string;
  category: ItemCategory;
  rarity: ItemRarity;
  setKey: string | null;
  dupe: boolean;
  paidWith: "ujc" | "ticket";
  shards: number;
  shardConverted: boolean;
}

export interface InventoryItem {
  inventoryId: number;
  itemId: number;
  code: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  setKey: string | null;
  stats: Record<string, number>;
  obtainedVia: string;
}
