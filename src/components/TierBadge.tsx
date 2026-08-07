import { TIER_ICON, TIER_STYLE } from "@/lib/tierBadge";

/** 학생 이름 옆에 붙는 성실도 티어 배지 — 아이콘 + 등급명.
 * 아직 등급이 안 잡힌 학생(입학 2주 미만)은 grade가 null이라 아무것도
 * 그리지 않는다. "등급 산정 중" 안내는 UJC 지갑 카드가 이미 하고 있다. */
export function TierBadge({ grade }: { grade: string | null }) {
  if (!grade) return null;

  return (
    <span
      className={
        "inline-flex flex-none items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold " +
        (TIER_STYLE[grade] ?? "bg-line-soft text-ink-secondary")
      }
    >
      <span aria-hidden>{TIER_ICON[grade] ?? "🎖️"}</span>
      {grade}
    </span>
  );
}
