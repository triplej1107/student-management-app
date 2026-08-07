"use client";

import type { ReactNode } from "react";
import { GUIDE_SEEN_KEY, GUIDE_VERSION } from "@/lib/guideVersion";

/**
 * 안내서로 가는 링크 — 누르는 순간 "이 버전은 봤다"고 기록해서 파란 점을 끈다.
 *
 * 안내서는 앱 밖의 정적 HTML이라 거기서 읽음 처리를 하려면 파일 3개에 같은
 * 스크립트를 심어야 한다. 누를 때 여기서 한 번 적어두는 편이 단순하다.
 */
export function GuideLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        try {
          localStorage.setItem(GUIDE_SEEN_KEY, GUIDE_VERSION);
          // storage 이벤트는 **다른 탭에만** 간다 — 이 탭의 점도 바로 끄려면
          // 직접 한 번 쏴줘야 한다(GuideNewDot이 이걸 듣는다).
          window.dispatchEvent(new StorageEvent("storage", { key: GUIDE_SEEN_KEY }));
        } catch {
          // 저장이 막혀 있으면 점이 계속 뜰 뿐, 안내서를 여는 건 막지 않는다.
        }
      }}
    >
      {children}
    </a>
  );
}
