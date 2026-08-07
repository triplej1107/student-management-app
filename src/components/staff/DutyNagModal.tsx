"use client";

import { useEffect, useState } from "react";

/**
 * 밤 9시 30분이 지났는데 업무 체크리스트가 다 안 됐을 때 뜨는 알림창.
 *
 * 확인을 누르면 그날은 다시 안 뜬다(기기에 저장). 화면을 열 때마다 다시
 * 뜨면 오히려 무시하게 되기 때문. 날짜를 키에 넣어서 다음 날이면 새로 뜬다.
 */
export function DutyNagModal({ dateISO, remaining }: { dateISO: string; remaining: number }) {
  const storageKey = `duty-nag-seen-${dateISO}`;
  // 처음엔 무조건 닫힌 상태로 그린다 — localStorage는 서버에서 못 읽으므로,
  // 처음 렌더에서 바로 읽으면 서버(닫힘)와 클라이언트(열림)가 어긋나
  // 하이드레이션 오류가 난다. 붙은 다음에 열지 말지 정한다.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey) !== "1") setOpen(true);
    } catch {
      setOpen(true); // 저장소가 막혀 있으면 그냥 띄운다
    }
  }, [storageKey]);

  if (!open) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // 저장이 막혀 있어도 창은 닫혀야 한다.
    }
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl">
        <div className="text-[15px] font-bold leading-relaxed text-ink">
          10시 30분 전입니다.
          <br />
          체크리스트를 체크하며 정리합시다
        </div>
        <div className="mt-2 text-[13px] text-ink-muted">아직 {remaining}개가 남았어요.</div>
        <button
          onClick={dismiss}
          className="mt-4 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white"
        >
          확인
        </button>
      </div>
    </div>
  );
}
