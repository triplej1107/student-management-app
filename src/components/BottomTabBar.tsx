"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { NavTab } from "@/lib/navTabs";

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
  성적: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <path d="M4 19.5h16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4.5 15 4.5-5 3.5 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h4v4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  밀림: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <path d="M12 3.5 2.5 20h19L12 3.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 10v4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="17.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  UJC: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <circle cx="12" cy="12" r="8.5" strokeWidth={1.8} />
      <path d="M8.7 8.2v5a3.3 3.3 0 0 0 6.6 0v-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  학생: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <circle cx="12" cy="8" r="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 20v-1.5A5.5 5.5 0 0 1 11 13h2a5.5 5.5 0 0 1 5.5 5.5V20" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  조교: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <rect x="3" y="3" width="18" height="18" rx="6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M12 7.5 13.3 10.2 16.2 10.6 14.1 12.6 14.6 15.5 12 14.1 9.4 15.5 9.9 12.6 7.8 10.6 10.7 10.2 12 7.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  왕관: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <path d="M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 18 3 9l5 4 4-6 4 6 5-4-1 9Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  시험: (active) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="h-[22px] w-[22px]">
      <rect x="5" y="3.5" width="12" height="17" rx="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8h6M8 11.5h6M8 15h3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m15.5 16.5 3-3 1.5 1.5-3 3-2 .5.5-2Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

const ROOT_HREFS = ["/staff", "/student", "/admin"];

export function BottomTabBar({
  tabs,
  dotHrefs,
}: {
  tabs: NavTab[];
  /** 새 소식이 있는 탭의 href 목록 — 아이콘 위에 작은 점만 찍는다.
   * 지금 보고 있는 탭에는 찍지 않는다(이미 보는 중이므로). */
  dotHrefs?: string[];
}) {
  const pathname = usePathname();
  const dots = new Set(dotHrefs ?? []);
  return (
    <div
      className="sticky bottom-0 z-10 flex box-border gap-1 border-t border-line bg-white px-2.5 pt-2 pb-[calc(env(safe-area-inset-bottom)+10px)]"
      style={{ boxShadow: "0 -6px 16px -8px rgb(0 0 0 / 0.12)" }}
    >
      {tabs.map((tab) => {
        const active =
          tab.href === pathname ||
          (!ROOT_HREFS.includes(tab.href) &&
            (tab.matchPrefixes ?? [tab.href]).some((p) => pathname.startsWith(p)));
        const icon = ICONS[tab.icon ?? tab.label]?.(active);

        if (tab.popped) {
          return (
            <Link key={tab.href} href={tab.href} className="relative flex flex-1 flex-col items-center">
              <div
                className={
                  "absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white shadow-[0_4px_14px_rgba(0,86,255,0.4)] " +
                  (active ? "bg-accent" : "bg-accent/85")
                }
              >
                <span className="text-white">{icon}</span>
              </div>
              {!tab.hideLabel && (
                <span
                  className={
                    "mt-9 text-[11px] font-bold " + (active ? "text-accent" : "text-ink-muted")
                  }
                >
                  {tab.label}
                </span>
              )}
            </Link>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              "flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-bold transition-colors " +
              (active ? "bg-accent-soft text-accent" : "text-ink-muted")
            }
          >
            <span className="relative">
              {icon}
              {dots.has(tab.href) && !active && (
                <span
                  aria-label="새 소식"
                  className="absolute -right-1 -top-0.5 h-[7px] w-[7px] rounded-full bg-accent ring-2 ring-white"
                />
              )}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
