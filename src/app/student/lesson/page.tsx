import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/authz";
import { getStudentById, getClassPlan } from "@/lib/data";
import { rollingClinicWeeks, weekLabel, toISODate, parseISODate, kstToday, nowKST } from "@/lib/weeks";
import { isWeeklyContentPublished } from "@/lib/weeklyContentVisibility";
import { PillLink, ScreenTitle } from "@/components/ui";
import { LessonPlanReadOnly } from "@/components/LessonPlanReadOnly";
import { TabSeenBeacon } from "@/components/TabSeenBeacon";

export default async function StudentLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await requireStudentSession();
  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const { week } = await searchParams;
  // 공개 시각(그 주 일요일 22시)이 지난 주차만 학생에게 보여준다. 종주T가
  // 미리 작성해둔 이번 주 수업은 그때까지 목록에도 뜨지 않는다 — 주소를
  // 직접 쳐서 들어와도 아래에서 다시 막는다.
  const todayISO = toISODate(kstToday());
  const kstHour = nowKST().getUTCHours();
  const weeks = rollingClinicWeeks(8).filter((w) =>
    isWeeklyContentPublished(toISODate(w), todayISO, kstHour)
  );
  const selectedWeekStart = week ? parseISODate(week) : weeks[0];
  const selectedWeekISO = selectedWeekStart ? toISODate(selectedWeekStart) : "";
  const selectedPublished =
    !!selectedWeekISO && isWeeklyContentPublished(selectedWeekISO, todayISO, kstHour);

  const plan =
    selectedPublished && student.class_key
      ? await getClassPlan(student.class_key, selectedWeekStart)
      : null;

  return (
    <div className="box-border px-5 pt-2 pb-7">
      <TabSeenBeacon tab="lesson" />
      <div className="border-b border-line pb-3 text-center">
        <ScreenTitle>수업</ScreenTitle>
        <div className="mt-1 text-xs italic text-ink-muted">유종의미 종주T</div>
        {selectedWeekStart && (
          <div className="mt-1.5 text-[13px] font-bold text-ink">{weekLabel(selectedWeekStart)}</div>
        )}
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto">
        {weeks.map((w) => {
          const iso = toISODate(w);
          return (
            <PillLink key={iso} href={`/student/lesson?week=${iso}`} active={iso === selectedWeekISO}>
              {weekLabel(w)}
            </PillLink>
          );
        })}
      </div>

      {selectedPublished ? (
        <LessonPlanReadOnly plan={plan} />
      ) : (
        <div className="mt-6 text-center text-[13px] text-ink-muted/70">
          이 주차 수업 내용은 아직 공개 전이에요.
        </div>
      )}
    </div>
  );
}
