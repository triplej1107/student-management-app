import { requireZongjuSession } from "@/lib/authz";
import { getClinicTemplate } from "@/lib/data";
import { getAnswerKeysForClassWeek, getOmrQuestionAnalysis } from "@/lib/clinicOmr";
import { CLASSES, type ClassKey } from "@/lib/types";
import { rollingClinicWeeks, weekLabel, toISODate, parseISODate } from "@/lib/weeks";
import { PillLink } from "@/components/ui";
import { AnswerKeyEditor } from "@/components/admin/AnswerKeyEditor";
import { OmrAnalysisPanel } from "@/components/admin/OmrAnalysisPanel";

export default async function AdminExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; week?: string }>;
}) {
  await requireZongjuSession();
  const { class: classParam, week: weekParam } = await searchParams;

  const classKey: ClassKey = CLASSES.includes(classParam as ClassKey)
    ? (classParam as ClassKey)
    : CLASSES[0];
  const weeks = rollingClinicWeeks(8);
  const selectedWeekStart = weekParam ? parseISODate(weekParam) : weeks[0];
  const selectedWeekISO = toISODate(selectedWeekStart);

  const [template, answerKeys] = await Promise.all([
    getClinicTemplate(classKey, selectedWeekStart),
    getAnswerKeysForClassWeek(classKey, selectedWeekISO),
  ]);

  const testLabels = template?.test_labels ?? ["", "", "", ""];
  const filledSlots = testLabels.map((label, i) => (label.trim() ? i : -1)).filter((i) => i >= 0);
  const analysisEntries = await Promise.all(
    filledSlots.map(
      async (i) => [i, await getOmrQuestionAnalysis(classKey, selectedWeekISO, i)] as const
    )
  );
  const analysisBySlot = Object.fromEntries(analysisEntries);

  return (
    <div>
      <div className="mt-4 text-[19px] font-extrabold text-ink">시험 관리</div>
      <div className="mt-1 text-xs text-ink-muted">
        클리닉테스트 칸마다 정답을 입력해두면 학생이 OMR마킹을 제출할 때 바로 채점돼요.
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-line-soft pb-4">
        {CLASSES.map((c) => (
          <PillLink key={c} href={`/admin/exams?class=${c}&week=${selectedWeekISO}`} active={c === classKey}>
            {c}
          </PillLink>
        ))}
      </div>
      <div className="mt-3.5 flex gap-1.5 overflow-x-auto">
        {weeks.map((w) => {
          const iso = toISODate(w);
          return (
            <PillLink key={iso} href={`/admin/exams?class=${classKey}&week=${iso}`} active={iso === selectedWeekISO}>
              {weekLabel(w)}
            </PillLink>
          );
        })}
      </div>

      <AnswerKeyEditor
        key={`${classKey}_${selectedWeekISO}`}
        classKey={classKey}
        weekStartISO={selectedWeekISO}
        testLabels={testLabels}
        answerKeys={Object.fromEntries(answerKeys)}
      />

      <OmrAnalysisPanel testLabels={testLabels} analysisBySlot={analysisBySlot} />
    </div>
  );
}
