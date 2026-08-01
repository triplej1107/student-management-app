import { requireZongjuSession } from "@/lib/authz";
import { getParentQuestionsForWeek } from "@/lib/parentQuestions";
import { rollingQuestionWeeks, questionWeekLabel, toISODate, parseISODate } from "@/lib/weeks";
import { AdminGroupedSubNav } from "@/components/admin/AdminTopNav";
import { PillLink, EmptyState } from "@/components/ui";
import { STUDENT_TAB_GROUPS } from "../subTabs";

export default async function AdminParentQuestionsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await requireZongjuSession();
  const { week: weekParam } = await searchParams;

  const weeks = rollingQuestionWeeks(12);
  const selectedWeekStart = weekParam ? parseISODate(weekParam) : weeks[0];
  const selectedWeekISO = toISODate(selectedWeekStart);

  const questions = await getParentQuestionsForWeek(selectedWeekISO);

  return (
    <div>
      <AdminGroupedSubNav groups={STUDENT_TAB_GROUPS} />
      <div className="mt-4 text-[19px] font-extrabold text-ink">학부모 질문 내역</div>
      <div className="mt-1 text-xs text-ink-muted">
        학부모 화면에는 이번 질문 주(수요일 리셋) 것만 보이지만, 여기서는 지난 주차 기록도 계속
        확인할 수 있어요.
      </div>

      <div className="mt-3.5 flex gap-1.5 overflow-x-auto">
        {weeks.map((w) => {
          const iso = toISODate(w);
          return (
            <PillLink key={iso} href={`/admin/students/questions?week=${iso}`} active={iso === selectedWeekISO}>
              {questionWeekLabel(w)}
            </PillLink>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {questions.length === 0 && <EmptyState>이 주에 남겨진 질문이 없어요.</EmptyState>}
        {questions.map((q) => (
          <div key={q.id} className="rounded-2xl border border-line-soft bg-white p-3.5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-ink">
                {q.studentName}
                {q.classTag && <span className="text-xs font-normal text-ink-muted"> ({q.classTag})</span>}
              </div>
              <span
                className={
                  "rounded-full px-2.5 py-1 text-[11px] font-bold " +
                  (q.answer_text ? "bg-success-soft text-success" : "bg-warn-soft text-warn")
                }
              >
                {q.answer_text ? "답변 완료" : "답변 대기중"}
              </span>
            </div>
            {q.schoolGrade && <div className="mt-0.5 text-xs text-ink-muted">{q.schoolGrade}</div>}
            <div className="mt-2 rounded-xl bg-bg-page p-2.5 text-[13px] leading-relaxed text-ink-secondary">
              {q.question_text}
            </div>
            {q.answer_text && (
              <div className="mt-2 rounded-xl bg-accent-soft p-2.5 text-[13px] leading-relaxed text-ink">
                <span className="font-bold text-accent">종주T ·</span> {q.answer_text}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
