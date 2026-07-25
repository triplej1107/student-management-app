"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DutyItem } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { toggleDutyCheckAction } from "@/app/staff/checklist/actions";

export function DutyChecklist({
  items,
  initialChecked,
  dateISO,
}: {
  items: DutyItem[];
  initialChecked: Record<number, boolean>;
  dateISO: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [checked, setChecked] = useState<Record<number, boolean>>(initialChecked);

  function toggle(itemId: number) {
    const next = !checked[itemId];
    setChecked((prev) => ({ ...prev, [itemId]: next }));
    startTransition(async () => {
      await toggleDutyCheckAction(itemId, dateISO, next);
      showToast(next ? "체크됨" : "체크 해제됨");
      router.refresh();
    });
  }

  return (
    <div className="mt-3.5 flex flex-col gap-2">
      {items.map((item) => {
        const isChecked = !!checked[item.id];
        return (
          <div
            key={item.id}
            onClick={() => toggle(item.id)}
            className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line-soft bg-white p-2.5"
          >
            <span
              className={
                "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-xs font-extrabold text-white " +
                (isChecked ? "border-accent bg-accent" : "border-line bg-white")
              }
            >
              {isChecked ? "✓" : ""}
            </span>
            <span
              className={
                "flex-1 text-[13px] " + (isChecked ? "text-ink-muted line-through" : "text-ink")
              }
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
