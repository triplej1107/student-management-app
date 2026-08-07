import Link from "next/link";
import { TIER_ICON, TIER_STYLE } from "@/lib/tierBadge";

export function UjcWalletCard({ balance, grade }: { balance: number; grade: string | null }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-accent to-accent-hover p-4 text-white shadow-[0_3px_14px_rgba(20,30,60,0.15)]">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-white/80">보유 UJC</div>
        <span
          className={
            "rounded-full px-2.5 py-1 text-[11px] font-bold " +
            (grade ? (TIER_STYLE[grade] ?? "bg-white/20 text-white") : "bg-white/20 text-white")
          }
        >
          {grade ? `${TIER_ICON[grade] ?? "🎖️"} ${grade}` : "등급 산정 중"}
        </span>
      </div>
      <div className="mt-1 text-[32px] font-extrabold">
        {balance} <span className="text-base font-bold">UJC</span>
      </div>

      <Link
        href="/student/ujc-market"
        className="mt-3 block rounded-xl bg-white/15 py-2.5 text-center text-xs font-bold text-white"
      >
        UJC마켓 →
      </Link>
    </div>
  );
}
