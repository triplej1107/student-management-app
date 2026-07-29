"use client";

import { useTransition } from "react";
import { useToast } from "@/components/Toast";

export function ClinicClearButton({
  studentId,
  weekStartISO,
  studentName,
  weekLabel,
  clearAction,
}: {
  studentId: number;
  weekStartISO: string;
  studentName: string;
  weekLabel: string;
  clearAction: (studentId: number, weekStartISO: string) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();

  function clear() {
    const ok = window.confirm(
      `${studentName} 학생의 ${weekLabel} 밀림을 청산할까요?\n실제 숙제/테스트 완료 여부는 바뀌지 않고, 밀림 목록에서만 빠집니다.`
    );
    if (!ok) return;
    startTransition(async () => {
      await clearAction(studentId, weekStartISO);
      showToast("밀림 청산됨");
    });
  }

  return (
    <button
      onClick={clear}
      disabled={pending}
      className="mt-2 text-[11px] font-bold text-ink-muted underline disabled:opacity-50"
    >
      밀림 청산
    </button>
  );
}
