"use client";

import Link from "next/link";

export function BacklogWarningModal({
  weeksOverdue,
  oldestIncompleteLabel,
  missingHwLabels,
  missingTestLabels,
  onDismiss,
}: {
  weeksOverdue: number;
  oldestIncompleteLabel: string;
  missingHwLabels: string[];
  missingTestLabels: string[];
  onDismiss: () => void;
}) {
  const urgent = weeksOverdue >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{urgent ? "⚠️" : "🔔"}</span>
          <div className="text-base font-extrabold text-ink">
            클리닉 점검표가 {weeksOverdue}주째 밀렸어요
          </div>
        </div>
        <div className="mt-1 text-xs text-ink-muted">{oldestIncompleteLabel}부터 아직 미완료예요.</div>

        {missingHwLabels.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-bold text-ink-muted">안 한 숙제</div>
            <ul className="flex flex-col gap-1">
              {missingHwLabels.map((label) => (
                <li key={label} className="rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {missingTestLabels.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs font-bold text-ink-muted">안 본 테스트</div>
            <ul className="flex flex-col gap-1">
              {missingTestLabels.map((label) => (
                <li key={label} className="rounded-lg bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 rounded-xl border border-line bg-white py-2.5 text-sm font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            나중에
          </button>
          <Link
            href="/student/clinic"
            className="flex-1 rounded-xl bg-accent py-2.5 text-center text-sm font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
          >
            지금 확인하기
          </Link>
        </div>
      </div>
    </div>
  );
}
