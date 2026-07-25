"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DutyItem } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { updateDutyItemAction, deleteDutyItemAction } from "@/app/admin/staff/duty/actions";

export function DutyItemEditor({ item }: { item: DutyItem }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [label, setLabel] = useState(item.label);

  function commit(value: string) {
    startTransition(async () => {
      await updateDutyItemAction(item.id, value);
      showToast("저장됨");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteDutyItemAction(item.id);
      showToast("항목 삭제됨");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-1.5">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        className="flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-[13px]"
      />
      <button
        onClick={remove}
        className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-xs font-bold text-danger"
      >
        삭제
      </button>
    </div>
  );
}
