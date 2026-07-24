import type { ClinicCheck, ClinicTemplate } from "@/lib/types";
import { filledHwSlots, filledTestSlots } from "@/lib/clinicProgress";

export function ClinicChecklistReadOnly({
  template,
  check,
}: {
  template: ClinicTemplate;
  check: ClinicCheck | undefined;
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
    </>
  );
}
