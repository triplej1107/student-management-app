"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { sendMonthlyReportNowAction } from "@/app/admin/reports/actions";

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function prevYearMonth() {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function MonthlyReportSender({ recipientEmail }: { recipientEmail: string | null }) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const thisMonth = currentYearMonth();
  const lastMonth = prevYearMonth();
  const [year, setYear] = useState(lastMonth.year);
  const [month, setMonth] = useState(lastMonth.month);

  function send() {
    setPending(true);
    startTransition(async () => {
      try {
        await sendMonthlyReportNowAction(year, month);
        showToast(`${year}년 ${month}월 보고서를 발송했어요`);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "발송 실패", "error");
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-3.5">
      <div className="mb-1 text-sm font-bold text-ink">전체 기록 보고서</div>
      <div className="mb-3 text-xs text-ink-muted">
        출결/클리닉체크리스트/성적/UJC 전체 기록을 엑셀로 정리해{" "}
        {recipientEmail ? <b>{recipientEmail}</b> : "등록된 이메일"}로 보내드려요. 매달 1일에 지난달
        기록이 자동으로 발송되고, 필요하면 아래에서 원하는 달을 바로 받아볼 수 있어요.
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-20 rounded-lg border border-line px-2.5 py-2 text-sm"
        />
        <span className="text-sm text-ink-muted">년</span>
        <input
          type="number"
          min={1}
          max={12}
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="w-16 rounded-lg border border-line px-2.5 py-2 text-sm"
        />
        <span className="text-sm text-ink-muted">월</span>
        <button
          onClick={() => {
            setYear(thisMonth.year);
            setMonth(thisMonth.month);
          }}
          className="rounded-lg border border-line px-2.5 py-2 text-xs font-bold text-ink-secondary"
        >
          이번 달
        </button>
        <button
          onClick={() => {
            setYear(lastMonth.year);
            setMonth(lastMonth.month);
          }}
          className="rounded-lg border border-line px-2.5 py-2 text-xs font-bold text-ink-secondary"
        >
          지난 달
        </button>
      </div>

      <button
        onClick={send}
        disabled={pending}
        className="mt-3 w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
      >
        {pending ? "보고서 만드는 중..." : `${year}년 ${month}월 보고서 지금 받기`}
      </button>
    </div>
  );
}
