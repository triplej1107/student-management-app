"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClinicCheck, ClinicOmrSubmission, ClinicTemplate } from "@/lib/types";
import { filledHwSlots, filledTestSlots } from "@/lib/clinicProgress";
import { useToast } from "@/components/Toast";
import { toggleZongjuApprovalAction, resetOmrSubmissionAction } from "@/app/admin/students/approvals/actions";

export function AdminApprovalChecklist({
  studentId,
  weekStartISO,
  template,
  check,
  staffApprovedByName,
  omrSubmissions,
}: {
  studentId: number;
  weekStartISO: string;
  template: ClinicTemplate;
  check: ClinicCheck | undefined;
  staffApprovedByName: string | null;
  omrSubmissions: Record<number, ClinicOmrSubmission>;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const hwSlots = filledHwSlots(template);
  const testSlots = filledTestSlots(template);
  const [zongjuApproved, setZongjuApproved] = useState(check?.zongju_approved ?? false);
  const [resetSlots, setResetSlots] = useState<Set<number>>(new Set());

  function toggle() {
    const next = !zongjuApproved;
    setZongjuApproved(next);
    startTransition(async () => {
      await toggleZongjuApprovalAction(studentId, weekStartISO, next);
      showToast(next ? "최종 결재 완료" : "최종 결재 취소됨");
      router.refresh();
    });
  }

  function resetOmr(i: number) {
    setResetSlots((prev) => new Set(prev).add(i));
    startTransition(async () => {
      await resetOmrSubmissionAction(studentId, weekStartISO, i);
      showToast("재응시할 수 있게 초기화했어요");
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
              const submission = !resetSlots.has(i) ? omrSubmissions[i] : undefined;
              return (
                <div key={i} className="rounded-[10px] border border-line-soft bg-white p-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-ink">{template.test_labels[i]}</span>
                    <span className="text-[13px] font-bold text-accent">{scoreLabel}</span>
                  </div>
                  {submission && (
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-line-soft pt-2">
                      <span className="text-[11px] text-ink-muted">
                        OMR마킹 제출됨
                        {submission.left_app && <span className="text-danger"> · 이탈로 자동 제출</span>}
                      </span>
                      <button
                        onClick={() => resetOmr(i)}
                        className="rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-ink-secondary"
                      >
                        재응시 허용
                      </button>
                    </div>
                  )}
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
          className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line-soft bg-white p-2.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
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

      {check?.feedback_text && (
        <div className="mt-[18px]">
          <div className="mb-2 text-[13px] font-bold text-ink">
            조교T의 피드백{" "}
            <span className={"font-normal " + (zongjuApproved ? "text-success" : "text-ink-muted")}>
              {zongjuApproved ? "(학부모 노출 중)" : "(최종 결재 후 학부모에게 노출돼요)"}
            </span>
          </div>
          <div className="rounded-[10px] border border-line-soft bg-white p-3 text-[13px] leading-relaxed text-ink-secondary">
            {check.feedback_text}
          </div>
        </div>
      )}
    </>
  );
}
