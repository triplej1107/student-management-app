"use client";

import { useSyncExternalStore } from "react";
import { GUIDE_SEEN_KEY, isGuideUnread } from "@/lib/guideVersion";

/** 다른 탭에서 안내서를 열어 읽음 처리하면 이 탭의 점도 같이 꺼진다. */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readUnread(): boolean {
  try {
    return isGuideUnread(localStorage.getItem(GUIDE_SEEN_KEY));
  } catch {
    // 시크릿 모드처럼 localStorage가 막힌 브라우저 — 점만 안 뜨면 된다.
    return false;
  }
}

/**
 * "안내서가 새로 갱신됐어요" 파란 점. 안내서를 한 번 열면 사라진다.
 *
 * 서버는 localStorage를 알 수 없으므로 서버 쪽 값은 항상 false다 — 그래서
 * 첫 화면엔 점이 없다가 붙는다. useState + useEffect로 읽으면 서버/브라우저
 * 결과가 갈려 하이드레이션이 깨지는데, useSyncExternalStore는 두 값을
 * 따로 받으므로 그 문제가 없다.
 */
export function GuideNewDot({ className = "" }: { className?: string }) {
  const unread = useSyncExternalStore(subscribe, readUnread, () => false);

  if (!unread) return null;

  return (
    <span
      aria-label="새로 갱신된 안내서가 있어요"
      // 점이 클릭을 가로채면 정작 눌러야 할 로고·버튼이 안 눌린다.
      className={`pointer-events-none block h-3 w-3 rounded-full border-2 border-white bg-accent shadow-[0_1px_4px_rgba(20,30,60,0.25)] ${className}`}
    />
  );
}
