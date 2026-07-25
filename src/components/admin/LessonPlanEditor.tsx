"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClassKey, ClassPlan } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { saveClassPlanFieldAction } from "@/app/admin/students/plans/actions";

const FIELDS = [
  { key: "progress_content", label: "진도내용" },
  { key: "clinic_content", label: "클리닉내용" },
  { key: "homework_content", label: "과제내용" },
] as const;

export function LessonPlanEditor({
  classKey,
  weekStartISO,
  plan,
}: {
  classKey: ClassKey;
  weekStartISO: string;
  plan: ClassPlan | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [values, setValues] = useState({
    progress_content: plan?.progress_content ?? "",
    clinic_content: plan?.clinic_content ?? "",
    homework_content: plan?.homework_content ?? "",
  });

  function commit(field: (typeof FIELDS)[number]["key"], value: string) {
    startTransition(async () => {
      await saveClassPlanFieldAction(classKey, weekStartISO, field, value);
      showToast("저장됨");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {FIELDS.map(({ key, label }) => (
        <div key={key}>
          <div className="mb-2 text-[13px] font-bold text-ink">{label}</div>
          <textarea
            value={values[key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
            onBlur={(e) => commit(key, e.target.value)}
            placeholder={`이번 주 ${label}을 입력하세요`}
            className="min-h-[90px] w-full box-border rounded-[10px] border border-line bg-white px-3 py-2.5 text-[13px]"
          />
        </div>
      ))}
    </div>
  );
}
