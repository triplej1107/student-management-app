import Image from "next/image";
import type { UjcMarketBrand } from "@/lib/types";

const BRAND_ICON: Record<UjcMarketBrand, { src: string; alt: string }> = {
  GS25: { src: "/brand/gs25.png", alt: "GS25" },
  GOOGLE_PLAY: { src: "/brand/google-play.png", alt: "구글플레이" },
  OLIVE_YOUNG: { src: "/brand/olive-young.png", alt: "올리브영" },
};

export function UjcBrandBadge({ brand, size = 44 }: { brand: UjcMarketBrand; size?: number }) {
  const icon = BRAND_ICON[brand];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
      style={{ width: size, height: size }}
    >
      <Image src={icon.src} alt={icon.alt} width={size * 0.68} height={size * 0.68} />
    </div>
  );
}
