"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminSubNav({
  tabs,
}: {
  tabs: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-b border-line-soft pb-4">
      {tabs.map((tab) => {
        const isCurrent = pathname === tab.href.split("?")[0];
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "rounded-full border px-3.5 py-2 text-[13px] font-bold shadow-[0_1px_4px_rgba(20,30,60,0.10)] " +
              (isCurrent
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-white text-ink-secondary")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
