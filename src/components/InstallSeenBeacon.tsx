"use client";

import { useEffect } from "react";

/** 화면이 standalone(설치된 상태)으로 열렸을 때만 서버에 조용히 알린다 —
 * 명단 관리에서 학생/학부모 설치 여부 근사치로 쓰기 위한 비콘. UI 없음. */
export function InstallSeenBeacon() {
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!isStandalone) return;
    fetch("/api/app-installed", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
