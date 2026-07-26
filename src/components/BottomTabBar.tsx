"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const ICONS: Record<string, (active: boolean) => ReactNode> = {
  홈: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  수업: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <path
        d="M5 5.5A2 2 0 0 1 7 4h11.5a.5.5 0 0 1 .5.5V18a1 1 0 0 1-1 1H7a2 2 0 0 0-2 2V5.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M5 18.5A2 2 0 0 1 7 17h11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  클리닉: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <rect x="5" y="4" width="14" height="17" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m8.5 13 2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  공지: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <path
        d="M4 10.5v3a1 1 0 0 0 1 1h2l4.5 3.2a.5.5 0 0 0 .8-.4V6.7a.5.5 0 0 0-.8-.4L7 9.5H5a1 1 0 0 0-1 1Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15.5 9a3.5 3.5 0 0 1 0 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.8 6.5a7 7 0 0 1 0 11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  출결: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <rect x="4" y="5" width="16" height="15" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 9.5h16M8 3v3.5M16 3v3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 14 2 2 4-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  체크리스트: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <path d="m4.5 6.5 1.5 1.5 2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4.5 13 1.5 1.5 2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4.5 19.5 1.5 1.5 2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 6.5h7.5M12 13h7.5M12 19.5h7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function BottomTabBar({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div
      className="sticky bottom-0 z-10 flex box-border gap-1 border-t border-line bg-white px-2.5 pt-2 pb-[calc(env(safe-area-inset-bottom)+10px)]"
      style={{ boxShadow: "0 -6px 16px -8px rgb(0 0 0 / 0.12)" }}
    >
      {tabs.map((tab) => {
        const active =
          tab.href === pathname ||
          (tab.href !== "/staff" && tab.href !== "/student" && pathname.startsWith(tab.href));
        const icon = ICONS[tab.label]?.(active);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-bold transition-colors " +
              (active ? "bg-accent-soft text-accent" : "text-ink-muted")
            }
          >
            {icon}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export const STAFF_TABS = [
  { href: "/staff", label: "홈" },
  { href: "/staff/attendance", label: "출결" },
  { href: "/staff/clinic", label: "클리닉" },
  { href: "/staff/checklist", label: "체크리스트" },
];

export const STUDENT_TABS = [
  { href: "/student", label: "홈" },
  { href: "/student/lesson", label: "수업" },
  { href: "/student/clinic", label: "클리닉" },
  { href: "/student/notices", label: "공지" },
];
