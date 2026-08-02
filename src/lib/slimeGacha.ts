import "server-only";
import { supabase } from "./supabase";
import { kstToday, mondayOf } from "./weeks";
import { getOrCreateSlime, seasonForWeek } from "./slimeXp";

// 슬라임 뽑기·인벤토리·착용 — 설계: game-design/설계-아이템카탈로그.md §4
// 뽑기 1회 = 뽑기권 1장(우선) 또는 1 UJC. 결제~지급은 slime_gacha_pull
// Postgres 함수(0034) 안에서 원자적으로 처리되고, advisory lock이
// 새로고침 연타 이중결제를 막는다.
// 타입은 클라이언트 공용인 slimeGachaTypes.ts에 있다.

import type { GachaResult, InventoryItem, ItemCategory, ItemRarity } from "./slimeGachaTypes";

export type { GachaResult, InventoryItem, ItemCategory, ItemRarity };

export async function gachaPull(studentId: number): Promise<GachaResult> {
  const { data, error } = await supabase.rpc("slime_gacha_pull", { p_student_id: studentId });
  if (error) {
    if (error.message?.includes("insufficient_balance")) {
      throw new Error("보유 UJC가 부족해요.");
    }
    if (error.message?.includes("no_items")) {
      throw new Error("뽑을 수 있는 아이템이 아직 없어요.");
    }
    throw new Error("뽑기에 실패했어요. 잠시 후 다시 시도해주세요.");
  }
  const r = data as {
    item_code: string;
    item_name: string;
    category: ItemCategory;
    rarity: ItemRarity;
    set_key: string | null;
    dupe: boolean;
    paid_with: "ujc" | "ticket";
    shards: number;
    shard_converted: boolean;
  };
  return {
    itemCode: r.item_code,
    itemName: r.item_name,
    category: r.category,
    rarity: r.rarity,
    setKey: r.set_key,
    dupe: r.dupe,
    paidWith: r.paid_with,
    shards: r.shards,
    shardConverted: r.shard_converted,
  };
}

/** 뽑기권 잔고 (조각 제외). */
export async function getTicketBalance(studentId: number): Promise<number> {
  const { data } = await supabase
    .from("gacha_tickets")
    .select("delta, kind")
    .eq("student_id", studentId);
  return (data ?? []).filter((r) => r.kind !== "shard").reduce((sum, r) => sum + (r.delta as number), 0);
}

/** 조각 잔고 (10개 = 뽑기권 1장, 전환은 뽑기 함수가 자동 처리). */
export async function getShardBalance(studentId: number): Promise<number> {
  const { data } = await supabase
    .from("gacha_tickets")
    .select("delta")
    .eq("student_id", studentId)
    .eq("kind", "shard");
  return (data ?? []).reduce((sum, r) => sum + (r.delta as number), 0);
}

export async function listInventory(studentId: number): Promise<InventoryItem[]> {
  const { data } = await supabase
    .from("game_inventory")
    .select("id, item_id, obtained_via, game_items(code, name, category, rarity, set_key, stats)")
    .eq("student_id", studentId)
    .order("id", { ascending: true });
  return ((data ?? []) as unknown as {
    id: number;
    item_id: number;
    obtained_via: string;
    game_items: {
      code: string;
      name: string;
      category: ItemCategory;
      rarity: ItemRarity;
      set_key: string | null;
      stats: Record<string, number>;
    };
  }[]).map((r) => ({
    inventoryId: r.id,
    itemId: r.item_id,
    code: r.game_items.code,
    name: r.game_items.name,
    category: r.game_items.category,
    rarity: r.game_items.rarity,
    setKey: r.game_items.set_key,
    stats: r.game_items.stats ?? {},
    obtainedVia: r.obtained_via,
  }));
}

/** 현재 시즌 슬라임의 착용 상태: slot → 아이템 code. */
export async function getEquippedCodes(slimeId: number): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("slime_equipment")
    .select("slot, game_inventory(game_items(code))")
    .eq("slime_id", slimeId);
  const out: Record<string, string> = {};
  for (const row of (data ?? []) as unknown as {
    slot: string;
    game_inventory: { game_items: { code: string } };
  }[]) {
    out[row.slot] = row.game_inventory.game_items.code;
  }
  return out;
}

/**
 * 착용/해제. inventoryId가 null이면 해당 슬롯 해제.
 * 본인 소유 인벤토리인지, 아이템 부위가 슬롯과 맞는지 서버에서 검증한다.
 */
export async function setEquipment(
  studentId: number,
  slot: ItemCategory,
  inventoryId: number | null
): Promise<void> {
  const season = await seasonForWeek(mondayOf(kstToday()));
  if (!season) throw new Error("아직 시즌이 시작되지 않았어요.");
  const slime = await getOrCreateSlime(studentId, season);
  if (!slime) throw new Error("슬라임을 찾을 수 없어요.");

  if (inventoryId === null) {
    await supabase.from("slime_equipment").delete().eq("slime_id", slime.id).eq("slot", slot);
    return;
  }

  const { data: inv } = await supabase
    .from("game_inventory")
    .select("id, student_id, game_items(category)")
    .eq("id", inventoryId)
    .maybeSingle();
  const invRow = inv as unknown as { id: number; student_id: number; game_items: { category: ItemCategory } } | null;
  if (!invRow || invRow.student_id !== studentId) throw new Error("보유하지 않은 아이템이에요.");
  if (invRow.game_items.category !== slot) throw new Error("이 부위에 착용할 수 없는 아이템이에요.");

  await supabase
    .from("slime_equipment")
    .upsert({ slime_id: slime.id, slot, inventory_id: inventoryId }, { onConflict: "slime_id,slot" });
}
