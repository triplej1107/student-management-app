import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getStudentById, getClinicTemplate } from "@/lib/data";
import { getAnswerKey, getOmrSubmission, questionWeights, isWeightedKey } from "@/lib/clinicOmr";
import { wrongAnswers } from "@/lib/omrReview";
import { filledTestSlots } from "@/lib/clinicProgress";
import { getToday } from "@/lib/today";
import { toISODate } from "@/lib/weeks";
import { BackButton } from "@/components/BackButton";
import { ScreenTitle, EmptyState } from "@/components/ui";
import { OmrMarkingCard } from "@/components/OmrMarkingCard";
import { StudentExamTimerBanner } from "@/components/StudentExamTimerBanner";
import { getExamTimerForStudentName } from "@/lib/examTimers";

export default async function StudentOmrPage() {
  const session = await getSession();
  if (session.role !== "student" || !session.studentId) notFound();

  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const { clinicWeekStart } = getToday();
  const weekStartISO = toISODate(clinicWeekStart);
  // 조교가 올려둔 시험 타이머 — 마킹하는 화면 안에 남은 시간을 띄운다.
  // 푸시로 부르지 않는 이유는 StudentExamTimerBanner 주석 참고.
  const examTimer = await getExamTimerForStudentName(student.name);
  const template = student.class_key ? await getClinicTemplate(student.class_key, clinicWeekStart) : null;
  const slots = filledTestSlots(template ?? undefined);

  const slotData = await Promise.all(
    slots.map(async (testIndex) => {
      const [key, submission] = await Promise.all([
        student.class_key ? getAnswerKey(student.class_key, weekStartISO, testIndex) : null,
        getOmrSubmission(student.id, weekStartISO, testIndex),
      ]);
      // 오답 정리는 서버에서만 계산한다 — 정답키 자체를 화면으로 내려보내면
      // 제출 전에 정답을 볼 수 있게 된다.
      const wrong = key && submission ? wrongAnswers(key.answers, submission.answers) : [];
      return { testIndex, label: template!.test_labels[testIndex], key, submission, wrong };
    })
  );

  return (
    <div className="box-border px-5 pt-2 pb-7">
      <BackButton href="/student" />
      <div className="border-b border-line pb-3 pt-1 text-center">
        <ScreenTitle>OMR마킹</ScreenTitle>
        <div className="mt-1 text-xs italic text-ink-muted">이번주 클리닉테스트를 채점받아요</div>
      </div>

      {examTimer && (
        <div className="mt-3">
          <StudentExamTimerBanner
            timer={{
              startAtISO: examTimer.start_at,
              durationSeconds: examTimer.duration_seconds,
              pausedRemainingSeconds: examTimer.paused_remaining_seconds,
              examLabel: examTimer.exam_label,
            }}
            showOmrLink={false}
          />
        </div>
      )}

      <div className="mt-3 rounded-xl bg-bg-page px-3 py-2.5 text-[11px] leading-relaxed text-ink-muted">
        잘못 마킹했다면 같은 번호를 한 번 더 누르면 지워져요.
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {slotData.length === 0 && <EmptyState>이번 주엔 등록된 클리닉테스트가 없어요.</EmptyState>}
        {slotData.map(({ testIndex, label, key, submission, wrong }) => (
          <OmrMarkingCard
            key={testIndex}
            testIndex={testIndex}
            label={label}
            answerCount={key && key.answers.length > 0 ? key.answers.length : 0}
            weights={key && key.answers.length > 0 ? questionWeights(key) : []}
            weighted={key ? isWeightedKey(key) : false}
            submission={submission}
            wrong={wrong}
          />
        ))}
      </div>
    </div>
  );
}
