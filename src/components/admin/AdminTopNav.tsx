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

/** 폴더(윗줄) + 그 폴더의 화면들(아랫줄) 2단 하위 네비.
 *
 * 지금 보고 있는 화면이 속한 폴더가 자동으로 열린다 — 폴더를 따로 기억해둘
 * 필요 없이, 어느 경로로 들어와도 제자리를 찾는다. 폴더를 누르면 그 폴더의
 * 첫 화면으로 바로 이동한다(폴더만 열리고 멈추면 한 번 더 눌러야 하므로). */
export function AdminGroupedSubNav({
  groups,
}: {
  groups: { label: string; tabs: { href: string; label: string }[] }[];
}) {
  const pathname = usePathname();
  const activeGroup =
    groups.find((g) => g.tabs.some((t) => pathname === t.href.split("?")[0])) ?? groups[0];

  return (
    <div className="mt-4 border-b border-line-soft pb-3">
      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const isCurrent = g === activeGroup;
          return (
            <Link
              key={g.label}
              href={g.tabs[0].href}
              className={
                "rounded-lg px-3 py-1.5 text-[13px] font-extrabold " +
                (isCurrent ? "bg-accent text-white" : "bg-line-soft text-ink-muted")
              }
            >
              {g.label}
            </Link>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {activeGroup.tabs.map((tab) => {
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
    </div>
  );
}
