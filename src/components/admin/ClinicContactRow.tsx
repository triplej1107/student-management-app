"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Toast";
import { toggleContactAction, saveContactNoteAction } from "@/app/admin/clinic-backlog/actions";

export function ClinicContactRow({
  studentId,
  initialContacted,
  initialNote,
}: {
  studentId: number;
  initialContacted: boolean;
  initialNote: string | null;
}) {
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [contacted, setContacted] = useState(initialContacted);
  const [note, setNote] = useState(initialNote ?? "");

  function toggle() {
    const next = !contacted;
    setContacted(next);
    startTransition(async () => {
      await toggleContactAction(studentId, next);
      showToast(next ? "연락 완료로 표시됨" : "미확인으로 되돌림");
    });
  }

  function commitNote(value: string) {
    startTransition(async () => {
      await saveContactNoteAction(studentId, value);
      showToast("메모 저장됨");
    });
  }

  return (
    <div className="mt-2 rounded-xl border border-line-soft bg-white p-2.5">
      <label className="flex items-center gap-2 text-xs font-bold text-ink">
        <input
          type="checkbox"
          checked={contacted}
          onChange={toggle}
          className="h-4 w-4"
        />
        연락 완료
      </label>
      <textarea
        defaultValue={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={(e) => commitNote(e.target.value)}
        placeholder="통화 결과, 학부모 반응, 보충 약속 등을 메모하세요"
        className="mt-2 min-h-[56px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-xs"
      />
    </div>
  );
}
