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

/** 알약 색. 점검표 주차처럼 "끝났다/안 끝났다"를 알약 자체로 보여줄 때 쓴다. */
export type PillTone = "default" | "none" | "done" | "todo";

const PILL_TONE: Record<PillTone, string> = {
  default: "border-line bg-white text-ink-secondary",
  // "그 주엔 할 일이 없었다"(원본 없음·입학 전) — 기본색과 같지만 도메인
  // 쪽(WeekStatus)에서 그대로 넘겨 쓸 수 있게 이름을 열어둔다.
  none: "border-line bg-white text-ink-secondary",
  done: "border-success/60 bg-success-soft text-success",
  todo: "border-danger/60 bg-danger-soft text-danger",
};

export function PillLink({
  href,
  active,
  tone = "default",
  children,
}: {
  href: string;
  active: boolean;
  /** 기본은 흰 알약. done이면 초록, todo면 빨강. */
  tone?: PillTone;
  children: ReactNode;
}) {
  // 색이 "끝났나"를 말하므로, 지금 보고 있는 주차는 색 대신 **테두리 강조**로
  // 알린다 — 안 그러면 선택한 순간 그 주차의 초록/빨강이 파랑에 덮인다.
  const toned = tone === "done" || tone === "todo";
  const base = toned ? PILL_TONE[tone] : active ? "border-accent bg-accent-soft text-accent" : PILL_TONE.default;
  const selected = active ? (toned ? "ring-2 ring-accent/60 font-extrabold" : "") : "";

  return (
    <Link
      href={href}
      scroll={false}
      className={`flex-none rounded-full border px-3.5 py-2 text-[13px] font-bold whitespace-nowrap shadow-[0_1px_4px_rgba(20,30,60,0.10)] ${base} ${selected}`}
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
