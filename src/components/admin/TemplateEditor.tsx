"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClassKey, ClinicTemplate } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { saveTemplateFieldAction } from "@/app/admin/students/templates/actions";

export function TemplateEditor({
  classKey,
  weekStartISO,
  template,
}: {
  classKey: ClassKey;
  weekStartISO: string;
  template: ClinicTemplate | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [month, setMonth] = useState(template?.month ?? "");
  const [round, setRound] = useState(template?.round ?? "");
  const [hw, setHw] = useState<string[]>(
    template?.hw_labels ?? ["", "", "", "", "", "", ""]
  );
  const [test, setTest] = useState<string[]>(template?.test_labels ?? ["", "", "", ""]);

  function commit(field: Parameters<typeof saveTemplateFieldAction>[2], value: string) {
    startTransition(async () => {
      await saveTemplateFieldAction(classKey, weekStartISO, field, value);
      showToast("저장됨");
      router.refresh();
    });
  }

  return (
    <>
      <div className="mt-4 flex gap-2">
        <input
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          onBlur={(e) => commit("month", e.target.value)}
          placeholder="월 (예: 6월)"
          className="flex-1 rounded-[10px] border border-line bg-white px-3 py-2.5 text-[13px]"
        />
        <input
          value={round}
          onChange={(e) => setRound(e.target.value)}
          onBlur={(e) => commit("round", e.target.value)}
          placeholder="회차 (예: 1회차)"
          className="flex-1 rounded-[10px] border border-line bg-white px-3 py-2.5 text-[13px]"
        />
      </div>

      <div className="mt-[18px]">
        <div className="mb-2 text-[13px] font-bold text-ink">숙제검사 (7칸)</div>
        <div className="flex flex-col gap-2">
          {hw.map((v, i) => (
            <input
              key={i}
              value={v}
              onChange={(e) => setHw((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
              onBlur={(e) => commit({ hw: i }, e.target.value)}
              placeholder={`숙제 ${i + 1}`}
              className="w-full box-border rounded-[10px] border border-line bg-white px-3 py-2.5 text-[13px]"
            />
          ))}
        </div>
      </div>

      <div className="mt-[18px]">
        <div className="mb-2 text-[13px] font-bold text-ink">클리닉테스트 (4칸)</div>
        <div className="flex flex-col gap-2">
          {test.map((v, i) => (
            <input
              key={i}
              value={v}
              onChange={(e) => setTest((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
              onBlur={(e) => commit({ test: i }, e.target.value)}
              placeholder={`테스트 ${i + 1}`}
              className="w-full box-border rounded-[10px] border border-line bg-white px-3 py-2.5 text-[13px]"
            />
          ))}
        </div>
      </div>
    </>
  );
}
