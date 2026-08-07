"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  formatRemaining,
  isBannerVisible,
  isPaused,
  remainingSeconds,
  studentBannerHeadline,
  timerLevel,
  type TimerLevel,
} from "@/lib/examTimerRules";

export interface StudentExamTimerInfo {
  startAtISO: string;
  durationSeconds: number;
  pausedRemainingSeconds: number | null;
  examLabel: string | null;
}

const TONE: Record<TimerLevel, string> = {
  normal: "border-accent/40 bg-accent-soft text-accent",
  warn: "border-warn/50 bg-warn-soft text-warn",
  urgent: "border-danger/50 bg-danger-soft text-danger",
  critical: "border-danger/50 bg-danger-soft text-danger",
  done: "border-danger/50 bg-danger-soft text-danger",
};

/**
 * 시험 보는 학생 화면에 뜨는 남은 시간 배너.
 *
 * 일부러 푸시 알림이 아니라 화면 안에 그린다 — OMR 마킹 중에는 화면을
 * 벗어나는 순간 그 시점 답안으로 자동 제출되는데(OmrMarkingCard 참고),
 * 알림을 누르면 앱이 전환되면서 바로 그 일이 벌어진다. 배너는 누를 것이
 * 없으니 그 사고가 원천적으로 안 난다.
 *
 * 남은 시간은 1초마다 빼는 게 아니라 매번 시작 시각과 지금 시각의 차이로
 * 다시 계산한다 — 화면이 잠겼다 돌아와도 어긋나지 않는다.
 */
export function StudentExamTimerBanner({
  timer,
  /** OMR 화면 안에서는 "마킹하러 가기" 링크가 필요 없다. */
  showOmrLink = true,
}: {
  timer: StudentExamTimerInfo;
  showOmrLink?: boolean;
}) {
  const state = {
    startAtISO: timer.startAtISO,
    durationSeconds: timer.durationSeconds,
    pausedRemainingSeconds: timer.pausedRemainingSeconds,
  };

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = remainingSeconds(state, nowMs);
  if (!isBannerVisible(remaining)) return null;

  const level = timerLevel(remaining);
  const paused = isPaused(state);
  const headline = studentBannerHeadline(level, paused);

  return (
    <div className={`rounded-2xl border p-3.5 ${TONE[paused ? "normal" : level]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold leading-snug">{headline}</div>
          {timer.examLabel?.trim() && (
            <div className="mt-0.5 truncate text-[11px] font-semibold opacity-80">
              {timer.examLabel.trim()}
            </div>
          )}
        </div>
        <div className="flex-none text-[26px] font-extrabold tabular-nums">
          {formatRemaining(remaining)}
        </div>
      </div>

      {showOmrLink && (
        <Link
          href="/student/omr"
          className="mt-2.5 block rounded-xl bg-white/70 py-2 text-center text-xs font-bold"
        >
          OMR 마킹하러 가기 →
        </Link>
      )}
    </div>
  );
}
