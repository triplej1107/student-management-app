"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

interface SubstituteRow {
  staffId: number;
  name: string;
  done: number;
  total: number;
}

export function DutySubstituteSection({
  dateISO,
  substitutes,
  options,
  addAction,
  removeAction,
}: {
  dateISO: string;
  substitutes: SubstituteRow[];
  options: { id: number; name: string }[];
  addAction: (dateISO: string, staffId: number) => Promise<void>;
  removeAction: (dateISO: string, staffId: number) => Promise<void>;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState<string>("");

  function add() {
    if (!picked) return;
    startTransition(async () => {
      await addAction(dateISO, Number(picked));
      setPicked("");
      showToast("대타 추가됨");
      router.refresh();
    });
  }

  function remove(staffId: number) {
    startTransition(async () => {
      await removeAction(dateISO, staffId);
      showToast("대타 삭제됨");
      router.refresh();
    });
  }

  return (
    <>
      {substitutes.map((s) => (
        <div
          key={s.staffId}
          className="flex items-center justify-between rounded-2xl border border-line-soft bg-white p-3.5"
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">대타</span>
            {s.name}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-1 text-xs font-bold bg-line-soft text-ink-muted">
              {s.done}/{s.total}
            </span>
            <button
              onClick={() => remove(s.staffId)}
              disabled={pending}
              className="text-xs font-bold text-danger disabled:opacity-50"
            >
              삭제
            </button>
          </div>
        </div>
      ))}

      {options.length > 0 && (
        <div className="flex gap-1.5">
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="flex-1 rounded-lg border border-dashed border-ink-secondary/60 bg-white px-2.5 py-2 text-xs text-ink-secondary"
          >
            <option value="">[대타] 조교 선택</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={pending || !picked}
            className="rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
          >
            추가
          </button>
        </div>
      )}
    </>
  );
}
