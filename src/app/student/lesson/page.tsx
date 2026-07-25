import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/authz";
import { getStudentById, getClassPlan } from "@/lib/data";
import { rollingWeeks, weekLabel, toISODate, parseISODate } from "@/lib/weeks";
import { PillLink, ScreenTitle } from "@/components/ui";
import { LessonPlanReadOnly } from "@/components/LessonPlanReadOnly";

export default async function StudentLessonPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await requireStudentSession();
  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const { week } = await searchParams;
  const weeks = rollingWeeks(8);
  const selectedWeekStart = week ? parseISODate(week) : weeks[0];
  const selectedWeekISO = toISODate(selectedWeekStart);

  const plan = student.class_key ? await getClassPlan(student.class_key, selectedWeekStart) : null;

  return (
    <div className="box-border px-5 pt-2 pb-7">
      <div className="border-b border-line pb-3 text-center">
        <ScreenTitle>수업</ScreenTitle>
        <div className="mt-1.5 text-[13px] font-bold text-ink">{weekLabel(selectedWeekStart)}</div>
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

      <LessonPlanReadOnly plan={plan} />
    </div>
  );
}
