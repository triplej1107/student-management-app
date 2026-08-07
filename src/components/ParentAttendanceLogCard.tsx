"use client";

import { useState } from "react";
import type { AttendanceStatus } from "@/lib/types";
import type { AttendanceLogEntry } from "@/lib/data";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** "8/2(토)" */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}(${DAY_LABELS[new Date(y, m - 1, d).getDay()]})`;
}

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  출석: "bg-success-soft text-success",
  지각: "bg-warn-soft text-warn",
  조정: "bg-accent-soft text-accent",
  결석: "bg-danger-soft text-danger",
};

/** 기본으로 펼쳐 보여주는 줄 수 — 나머지는 "전체 보기"로 (두 달치까지). */
const PREVIEW_COUNT = 3;

/**
 * 학부모 홈의 "출결 로그" — 클리닉과 주말 강의를 한 줄기로 합쳐 최신순으로
 * 쌓아 보여준다(줄 앞의 배지로 어느 쪽 수업인지 구분). 푸시 알림을 놓쳤거나
 * 앱 설치에 실패해 알림을 못 받는 학부모가 기록으로 확인할 수 있어야 해서
 * 만든 화면이다.
 */
export function ParentAttendanceLogCard({ entries }: { entries: AttendanceLogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entries : entries.slice(0, PREVIEW_COUNT);
  const hiddenCount = entries.length - visible.length;

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-3.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)]">
      <div className="text-sm font-extrabold text-ink">출결 로그</div>

      {entries.length === 0 ? (
        <div className="mt-2 text-[13px] text-ink-muted/70">아직 출결 기록이 없어요.</div>
      ) : (
        <>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {visible.map((e) => (
              <div
                key={`${e.kind}-${e.dateISO}`}
                className="flex items-center justify-between rounded-xl bg-bg px-3 py-2"
              >
                <div className="text-[13px] font-semibold text-ink-secondary">
                  <span
                    className={
                      "mr-1.5 rounded px-1 py-0.5 text-[10px] font-bold " +
                      (e.kind === "강의"
                        ? "bg-accent-soft text-accent"
                        : "bg-line-soft text-ink-muted")
                    }
                  >
                    {e.kind}
                  </span>
                  {formatDate(e.dateISO)} {e.recordedAt}
                  {e.makeupDateISO && e.makeupTime && (
                    <span className="ml-1.5 text-[11px] font-normal text-ink-muted">
                      → {formatDate(e.makeupDateISO)} {e.makeupTime}
                    </span>
                  )}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[e.status]}`}
                >
                  {e.status}
                </span>
              </div>
            ))}
          </div>

          {(hiddenCount > 0 || expanded) && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 w-full text-center text-xs font-bold text-accent"
            >
              {expanded ? "접기" : `전체 보기 (${hiddenCount}건 더)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
