"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TOP_TABS = [
  { href: "/admin", label: "홈", match: (p: string) => p === "/admin" },
  { href: "/admin/students/templates", label: "학생 관리", match: (p: string) => p.startsWith("/admin/students") },
  { href: "/admin/staff/profiles", label: "조교 관리", match: (p: string) => p.startsWith("/admin/staff") },
  { href: "/admin/clinic-backlog", label: "밀림 관리", match: (p: string) => p.startsWith("/admin/clinic-backlog") },
  { href: "/admin/ujc", label: "UJC 관리", match: (p: string) => p.startsWith("/admin/ujc") },
  { href: "/admin/reports", label: "보고서", match: (p: string) => p.startsWith("/admin/reports") },
];

export function AdminTopNav() {
  const pathname = usePathname();

  return (
    <div className="mt-4 flex gap-2 border-b border-line-soft pb-4">
      {TOP_TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={
            "flex-1 rounded-xl border py-3 text-center text-sm font-bold " +
            (tab.match(pathname)
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-white text-ink-secondary")
          }
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

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
              "rounded-full border px-3.5 py-2 text-[13px] font-bold " +
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
