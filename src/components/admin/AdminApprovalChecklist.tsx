"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClinicCheck, ClinicTemplate } from "@/lib/types";
import { filledHwSlots, filledTestSlots } from "@/lib/clinicProgress";
import { toggleZongjuApprovalAction } from "@/app/admin/students/approvals/actions";

export function AdminApprovalChecklist({
  studentId,
  weekStartISO,
  template,
  check,
  staffApprovedByName,
}: {
  studentId: number;
  weekStartISO: string;
  template: ClinicTemplate;
  check: ClinicCheck | undefined;
  staffApprovedByName: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const hwSlots = filledHwSlots(template);
  const testSlots = filledTestSlots(template);
  const [zongjuApproved, setZongjuApproved] = useState(check?.zongju_approved ?? false);

  function toggle() {
    const next = !zongjuApproved;
    setZongjuApproved(next);
    startTransition(async () => {
      await toggleZongjuApprovalAction(studentId, weekStartISO, next);
      router.refresh();
    });
  }

  return (
    <>
      {hwSlots.length > 0 && (
        <div className="mt-[18px]">
          <div className="mb-2 text-[13px] font-bold text-ink">숙제검사</div>
          <div className="flex flex-col gap-2">
            {hwSlots.map((i) => {
              const checked = !!check?.hw_checks?.[i];
              return (
                <div
                  key={i}
                  className="flex items-center gap-2.5 rounded-[10px] border border-line-soft bg-white p-2.5"
                >
                  <span
                    className={
                      "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-xs font-extrabold text-white " +
                      (checked ? "border-accent bg-accent" : "border-line bg-white")
                    }
                  >
                    {checked ? "✓" : ""}
                  </span>
                  <span className="flex-1 text-[13px] text-ink">{template.hw_labels[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {testSlots.length > 0 && (
        <div className="mt-[18px]">
          <div className="mb-2 text-[13px] font-bold text-ink">클리닉테스트</div>
          <div className="flex flex-col gap-2">
            {testSlots.map((i) => {
              const t = check?.test_scores?.[i];
              const scoreLabel = t?.score || t?.total ? `${t?.score ?? "-"} / ${t?.total ?? "-"}` : "-";
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-[10px] border border-line-soft bg-white p-2.5"
                >
                  <span className="text-[13px] text-ink">{template.test_labels[i]}</span>
                  <span className="text-[13px] font-bold text-accent">{scoreLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-[18px] border-t border-line-soft pt-[18px]">
        <div className="flex items-center gap-2.5 rounded-[10px] bg-bg-page p-2.5">
          <span
            className={
              "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-xs font-extrabold text-white " +
              (check?.staff_approved ? "border-accent bg-accent" : "border-line bg-white")
            }
          >
            {check?.staff_approved ? "✓" : ""}
          </span>
          <span className="flex-1 text-[13px] text-ink-muted">
            조교 결재 {check?.staff_approved ? "완료" : "대기중"}
          </span>
          {check?.staff_approved && staffApprovedByName && (
            <span className="text-[11px] text-ink-muted">{staffApprovedByName}</span>
          )}
        </div>

        <div
          onClick={toggle}
          className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line-soft bg-white p-2.5"
        >
          <span
            className={
              "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-xs font-extrabold text-white " +
              (zongjuApproved ? "border-accent bg-accent" : "border-line bg-white")
            }
          >
            {zongjuApproved ? "✓" : ""}
          </span>
          <span className="flex-1 text-[13px] font-bold text-ink">종주T 최종 결재</span>
        </div>
      </div>
    </>
  );
}
