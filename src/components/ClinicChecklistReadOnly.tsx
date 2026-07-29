import type { ClinicCheck, ClinicTemplate } from "@/lib/types";
import { filledHwSlots, filledTestSlots } from "@/lib/clinicProgress";

export function ClinicChecklistReadOnly({
  template,
  check,
  feedbackText,
  zongjuFeedbackText,
}: {
  template: ClinicTemplate;
  check: ClinicCheck | undefined;
  feedbackText?: string | null;
  zongjuFeedbackText?: string | null;
}) {
  const hwSlots = filledHwSlots(template);
  const testSlots = filledTestSlots(template);

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

      <div className="mt-[18px] flex gap-2 border-t border-line-soft pt-[18px]">
        <div className="flex flex-1 items-center gap-2 rounded-[10px] bg-bg-page p-2.5">
          <span
            className={
              "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-xs font-extrabold text-white " +
              (check?.staff_approved ? "border-accent bg-accent" : "border-line bg-white")
            }
          >
            {check?.staff_approved ? "✓" : ""}
          </span>
          <span className="text-[13px] text-ink-muted">조교 확인</span>
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-[10px] bg-bg-page p-2.5">
          <span
            className={
              "flex h-[18px] w-[18px] flex-none items-center justify-center rounded-[5px] border text-xs font-extrabold text-white " +
              (check?.zongju_approved ? "border-accent bg-accent" : "border-line bg-white")
            }
          >
            {check?.zongju_approved ? "✓" : ""}
          </span>
          <span className="text-[13px] text-ink-muted">종주T 확인</span>
        </div>
      </div>

      {feedbackText && (
        <div className="mt-[18px]">
          <div className="mb-2 text-[13px] font-bold text-ink">
            조교T의 피드백{" "}
            <span className="font-normal text-ink-muted">(클리닉수업 참여태도만 평가합니다)</span>
          </div>
          <div className="rounded-[10px] border border-line-soft bg-white p-3 text-[13px] leading-relaxed text-ink-secondary">
            {feedbackText}
          </div>
        </div>
      )}

      {zongjuFeedbackText && (
        <div className="mt-[18px]">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-[#B76E00]">
            <span>👑</span> 종주T의 피드백
          </div>
          <div className="rounded-[10px] border-[1.5px] border-[#F0C766] bg-gradient-to-br from-[#FFF9EC] to-[#FFF3D6] p-3 text-[13px] leading-relaxed text-[#6B4E12] shadow-[0_2px_10px_rgba(230,180,60,0.25)]">
            {zongjuFeedbackText}
          </div>
        </div>
      )}
    </>
  );
}
