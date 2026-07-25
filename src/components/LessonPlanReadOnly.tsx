import type { ClassPlan } from "@/lib/types";

const FIELDS = [
  { key: "progress_content", label: "진도내용" },
  { key: "clinic_content", label: "클리닉내용" },
  { key: "homework_content", label: "과제내용" },
] as const;

export function LessonPlanReadOnly({ plan }: { plan: ClassPlan | null }) {
  const filled = plan ? FIELDS.filter((f) => plan[f.key].trim()) : [];

  if (filled.length === 0) {
    return (
      <div className="mt-6 text-center text-[13px] text-ink-muted/70">
        이번 주는 아직 등록된 수업계획이 없어요.
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      {filled.map(({ key, label }) => (
        <div key={key} className="rounded-2xl border border-line-soft bg-white p-3.5">
          <div className="mb-1.5 text-[13px] font-bold text-ink">{label}</div>
          <div className="whitespace-pre-line text-[13px] leading-relaxed text-ink-secondary">
            {plan![key]}
          </div>
        </div>
      ))}
    </div>
  );
}
