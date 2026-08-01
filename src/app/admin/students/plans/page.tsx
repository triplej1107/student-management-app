import { requireZongjuSession } from "@/lib/authz";
import { getClassPlan } from "@/lib/data";
import { CLASSES, type ClassKey } from "@/lib/types";
import { rollingLessonWeeks, weekLabel, toISODate, parseISODate, kstToday, nowKST } from "@/lib/weeks";
import { isLessonPlanPublished, publishDateISO } from "@/lib/lessonPlanVisibility";
import { AdminGroupedSubNav } from "@/components/admin/AdminTopNav";
import { PillLink } from "@/components/ui";
import { LessonPlanEditor } from "@/components/admin/LessonPlanEditor";
import { STUDENT_TAB_GROUPS } from "../subTabs";

export default async function AdminLessonPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; week?: string }>;
}) {
  await requireZongjuSession();
  const { class: classParam, week: weekParam } = await searchParams;

  const classKey: ClassKey = CLASSES.includes(classParam as ClassKey)
    ? (classParam as ClassKey)
    : CLASSES[0];
  const weeks = rollingLessonWeeks(9);
  const selectedWeekStart = weekParam ? parseISODate(weekParam) : weeks[0];
  const selectedWeekISO = toISODate(selectedWeekStart);

  const plan = await getClassPlan(classKey, selectedWeekStart);

  const todayISO = toISODate(kstToday());
  const kstHour = nowKST().getUTCHours();
  const published = isLessonPlanPublished(selectedWeekISO, todayISO, kstHour);
  const publishOn = publishDateISO(selectedWeekISO);

  return (
    <div>
      <AdminGroupedSubNav groups={STUDENT_TAB_GROUPS} />

      <div className="mt-4 flex flex-wrap gap-2 border-b border-line-soft pb-4">
        {CLASSES.map((c) => (
          <PillLink key={c} href={`/admin/students/plans?class=${c}&week=${selectedWeekISO}`} active={c === classKey}>
            {c}
          </PillLink>
        ))}
      </div>
      <div className="mt-3.5 flex gap-1.5 overflow-x-auto">
        {weeks.map((w) => {
          const iso = toISODate(w);
          return (
            <PillLink key={iso} href={`/admin/students/plans?class=${classKey}&week=${iso}`} active={iso === selectedWeekISO}>
              {weekLabel(w)}
            </PillLink>
          );
        })}
      </div>

      <div
        className={
          "mt-3.5 rounded-xl px-3 py-2 text-[11px] font-bold " +
          (published ? "bg-success-soft text-success" : "bg-warn-soft text-warn")
        }
      >
        {published ? (
          <>🌐 학생·학부모에게 공개 중인 주차예요.</>
        ) : (
          <>
            🔒 아직 학생에게 안 보여요 — {publishOn.slice(5).replace("-", "/")}(일) 밤 10시에 자동으로
            공개됩니다. 미리 편하게 작성해두세요.
          </>
        )}
      </div>

      <LessonPlanEditor
        key={`${classKey}_${selectedWeekISO}`}
        classKey={classKey}
        weekStartISO={selectedWeekISO}
        plan={plan}
      />
    </div>
  );
}
