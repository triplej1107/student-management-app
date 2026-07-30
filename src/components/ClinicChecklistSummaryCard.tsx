import Link from "next/link";
import type { ClinicCheck, ClinicTemplate } from "@/lib/types";
import { clinicProgressLabel, testProgressLabel, approvalStatus, approvalLabel } from "@/lib/clinicProgress";

const APPROVAL_BADGE_STYLE: Record<string, string> = {
  "no-template": "bg-line-soft text-ink-muted",
  unchecked: "bg-line-soft text-ink-muted",
  "staff-approved": "bg-warn-soft text-warn",
  "zongju-approved": "bg-success-soft text-success",
};

/** 학생 홈 화면 전용 요약 카드 — 보유 UJC 박스와 비슷한 크기 안에 이번주
 * 클리닉 점검표 상태를 한눈에 담는다. 전체 숙제/문항별 내용은
 * /student/clinic(자세히 보기)에서 본다. */
export function ClinicChecklistSummaryCard({
  weekLabelText,
  template,
  check,
}: {
  weekLabelText: string;
  template: ClinicTemplate | null;
  check: ClinicCheck | undefined;
}) {
  const hwLabel = clinicProgressLabel(template ?? undefined, check);
  const testLabel = testProgressLabel(template ?? undefined, check);
  const status = approvalStatus(template ?? undefined, check);

  return (
    <Link
      href="/student/clinic"
      className="block rounded-2xl border border-line-soft bg-white p-4 shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-ink-muted">이번주 클리닉 점검표</div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${APPROVAL_BADGE_STYLE[status]}`}>
          {approvalLabel(status)}
        </span>
      </div>
      <div className="mt-1 text-[15px] font-bold text-ink">
        {hwLabel}
        {testLabel && <span className="text-ink-muted"> · {testLabel}</span>}
      </div>
      <div className="mt-1 text-xs text-ink-muted">{weekLabelText}</div>
      <div className="mt-3 block rounded-xl bg-bg-page py-2.5 text-center text-xs font-bold text-accent">
        자세히 보기 →
      </div>
    </Link>
  );
}
