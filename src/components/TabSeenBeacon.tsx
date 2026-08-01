"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markTabSeenAction } from "@/app/tabSeenActions";

/** 이 탭 화면을 실제로 열었다고 서버에 알려 하단 탭의 "새 소식" 점을 끈다.
 * UI 없음. 서버 렌더가 아니라 브라우저 마운트 후에 부르기 때문에, 링크
 * 미리불러오기(prefetch)만으로 읽음 처리되는 일이 없다.
 *
 * 읽음 처리 후 router.refresh()로 레이아웃을 다시 그려야 점이 바로 사라진다
 * (하단 탭바는 레이아웃에서 렌더되므로 페이지만 바뀌어선 갱신되지 않는다). */
export function TabSeenBeacon({ tab }: { tab: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    markTabSeenAction(tab)
      .then(() => {
        if (!cancelled) router.refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, router]);

  return null;
}
