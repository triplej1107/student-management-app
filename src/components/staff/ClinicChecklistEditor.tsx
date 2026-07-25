"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClinicCheck, ClinicTemplate, TestScore } from "@/lib/types";
import { filledHwSlots, filledTestSlots } from "@/lib/clinicProgress";
import { useToast } from "@/components/Toast";
import {
  toggleHwCheckAction,
  updateTestScoreAction,
  toggleStaffApprovalAction,
} from "@/app/staff/clinic/actions";

export function ClinicChecklistEditor({
  studentId,
  weekStartISO,
  template,
  check,
  staffApprovedByName,
  currentStaffName,
  zongjuApproved,
}: {
  studentId: number;
  weekStartISO: string;
  template: ClinicTemplate;
  check: ClinicCheck | undefined;
  staffApprovedByName: string | null;
  currentStaffName: string;
  zongjuApproved: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const hwSlots = filledHwSlots(template);
  const testSlots = filledTestSlots(template);
  const [hwChecks, setHwChecks] = useState<boolean[]>(
    check?.hw_checks ?? [false, false, false, false, false, false, false]
  );
  const [testScores, setTestScores] = useState<TestScore[]>(
    check?.test_scores ?? [{}, {}, {}, {}]
  );
  const [staffApproved, setStaffApproved] = useState(check?.staff_approved ?? false);
  const [approvedByName, setApprovedByName] = useState(staffApprovedByName);

  function toggleApproval() {
    const next = !staffApproved;
    setStaffApproved(next);
    setApprovedByName(next ? currentStaffName : null);
    startTransition(async () => {
      await toggleStaffApprovalAction(studentId, weekStartISO, next);
      showToast(next ? "조교 결재 완료" : "조교 결재 취소됨");
      router.refresh();
    });
  }

  function toggleHw(i: number) {
    const next = !hwChecks[i];
    setHwChecks((prev) => prev.map((v, idx) => (idx === i ? next : v)));
    startTransition(async () => {
      await toggleHwCheckAction(studentId, weekStartISO, i, next);
      showToast("저장됨");
      router.refresh();
    });
  }

  function updateScore(i: number, field: "score" | "total", value: string) {
    setTestScores((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  }

  function commitScore(i: number, field: "score" | "total", value: string) {
    startTransition(async () => {
      await updateTestScoreAction(studentId, weekStartISO, i, field, value);
      showToast("저장됨");
      router.refresh();
    });
  }

  return (
    <>
      {hwSlots.length > 0 && (
        <div className="mt-[18px]">
          <div className="mb-2 text-[13px] font-bold text-ink">숙제검사</div>
          <div className="flex flex-col gap-2">
            {hwSlots.map((i) => (
              <div
                key={i}
                onClick={() => toggleHw(i)}
                className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line-soft bg-white p-2.5"
              >
                <span
                  className={
                    "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-xs font-extrabold text-white " +
                    (hwChecks[i] ? "border-accent bg-accent" : "border-line bg-white")
                  }
                >
                  {hwChecks[i] ? "✓" : ""}
                </span>
                <span className="flex-1 text-[13px] text-ink">{template.hw_labels[i]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {testSlots.length > 0 && (
        <div className="mt-[18px]">
          <div className="mb-2 text-[13px] font-bold text-ink">클리닉테스트</div>
          <div className="flex flex-col gap-2">
            {testSlots.map((i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-[10px] border border-line-soft bg-white p-2.5"
              >
                <span className="flex-1 text-[13px] text-ink">{template.test_labels[i]}</span>
                <input
                  value={testScores[i]?.score ?? ""}
                  onChange={(e) => updateScore(i, "score", e.target.value)}
                  onBlur={(e) => commitScore(i, "score", e.target.value)}
                  placeholder="점수"
                  className="w-11 rounded-md border border-line px-0.5 py-1.5 text-center text-xs"
                />
                <span className="text-ink-muted">/</span>
                <input
                  value={testScores[i]?.total ?? ""}
                  onChange={(e) => updateScore(i, "total", e.target.value)}
                  onBlur={(e) => commitScore(i, "total", e.target.value)}
                  placeholder="총점"
                  className="w-11 rounded-md border border-line px-0.5 py-1.5 text-center text-xs"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-[18px] border-t border-line-soft pt-[18px]">
        <div
          onClick={toggleApproval}
          className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line-soft bg-white p-2.5"
        >
          <span
            className={
              "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-xs font-extrabold text-white " +
              (staffApproved ? "border-accent bg-accent" : "border-line bg-white")
            }
          >
            {staffApproved ? "✓" : ""}
          </span>
          <span className="flex-1 text-[13px] font-bold text-ink">조교 결재</span>
          {staffApproved && approvedByName && (
            <span className="text-[11px] text-ink-muted">{approvedByName}</span>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2.5 rounded-[10px] bg-bg-page p-2.5">
          <span
            className={
              "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-xs font-extrabold text-white " +
              (zongjuApproved ? "border-accent bg-accent" : "border-line bg-white")
            }
          >
            {zongjuApproved ? "✓" : ""}
          </span>
          <span className="flex-1 text-[13px] text-ink-muted">
            종주T 최종 결재 {zongjuApproved ? "완료" : "대기중"}
          </span>
        </div>
      </div>
    </>
  );
}
