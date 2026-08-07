"use client";

import Link from "next/link";
import { useState } from "react";

/** 강의 출결 날짜 고르기 — 주말 수업이라 요일 탭보다 날짜가 직관적이다.
 * 어제·오늘 버튼과 직접 고르기를 같이 둔다. */
export function LectureDatePicker({
  basePath,
  dateISO,
}: {
  basePath: string;
  dateISO: string;
}) {
  const [value, setValue] = useState(dateISO);

  const shift = (days: number) => {
    const [y, m, d] = dateISO.split("-").map(Number);
    const next = new Date(y, m - 1, d + days);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="mt-3.5 flex items-center gap-2">
      <Link
        href={`${basePath}?date=${shift(-1)}`}
        className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs font-bold text-ink-secondary"
      >
        ‹ 이전
      </Link>
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[13px]"
      />
      {value !== dateISO && (
        <Link
          href={`${basePath}?date=${value}`}
          className="rounded-lg bg-accent px-2.5 py-2 text-xs font-bold text-white"
        >
          이동
        </Link>
      )}
      <Link
        href={`${basePath}?date=${shift(1)}`}
        className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs font-bold text-ink-secondary"
      >
        다음 ›
      </Link>
    </div>
  );
}
