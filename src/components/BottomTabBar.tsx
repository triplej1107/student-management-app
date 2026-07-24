"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomTabBar({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="sticky bottom-0 flex box-border border-t border-line bg-white px-2 pt-2.5 pb-[22px]">
      {tabs.map((tab) => {
        const active =
          tab.href === pathname ||
          (tab.href !== "/staff" && tab.href !== "/student" && pathname.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "flex-1 py-1.5 text-center text-xs font-bold " +
              (active ? "text-accent" : "text-ink-muted")
            }
          >
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
  { href: "/student/clinic", label: "클리닉" },
  { href: "/student/notices", label: "공지" },
];
