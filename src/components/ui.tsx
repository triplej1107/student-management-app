import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  children,
  onClick,
  clickable = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  /** Link로 감싸는 등 onClick 없이도 클릭 가능한 카드일 때 지정 — 버튼처럼 보이도록 은은한 그림자를 준다. */
  clickable?: boolean;
  className?: string;
}) {
  const isClickable = clickable || !!onClick;
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-line-soft bg-white p-3.5 ${isClickable ? "cursor-pointer shadow-[0_3px_14px_rgba(20,30,60,0.12)]" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function ScreenTitle({ children }: { children: ReactNode }) {
  return <div className="text-xl font-extrabold text-ink">{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-sm font-bold text-ink">{children}</div>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 text-center text-[13px] text-ink-muted/70">{children}</div>
  );
}

export function PillLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={
        "flex-none rounded-full px-3.5 py-2 text-[13px] font-bold whitespace-nowrap shadow-[0_3px_14px_rgba(20,30,60,0.12)] " +
        (active
          ? "border border-accent bg-accent-soft text-accent"
          : "border border-line bg-white text-ink-secondary")
      }
    >
      {children}
    </Link>
  );
}

export function PillRow({ children }: { children: ReactNode }) {
  return <div className="mt-3.5 flex gap-2 flex-wrap">{children}</div>;
}

export function ScrollPillRow({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex gap-1.5 overflow-x-auto">{children}</div>;
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent">
      {children}
    </span>
  );
}
