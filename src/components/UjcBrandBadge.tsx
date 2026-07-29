import type { UjcMarketBrand } from "@/lib/types";

// 실제 브랜드 로고 이미지 대신 텍스트+브랜드 컬러 배지로 표현 (상표
// 이미지 자산을 임의로 가져다 쓰지 않기 위함).
const BRAND_STYLE: Record<UjcMarketBrand, { bg: string; fg: string; label: string }> = {
  GS25: { bg: "#00A651", fg: "#FFFFFF", label: "GS25" },
  GOOGLE_PLAY: { bg: "#01875F", fg: "#FFFFFF", label: "Play" },
  OLIVE_YOUNG: { bg: "#111111", fg: "#FFFFFF", label: "올리브영" },
};

export function UjcBrandBadge({ brand, size = 44 }: { brand: UjcMarketBrand; size?: number }) {
  const style = BRAND_STYLE[brand];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl text-[11px] font-extrabold leading-tight"
      style={{ background: style.bg, color: style.fg, width: size, height: size }}
    >
      {style.label}
    </div>
  );
}
