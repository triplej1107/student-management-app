import { requireZongjuSession } from "@/lib/authz";
import { getClinicTemplate } from "@/lib/data";
import { CLASSES, type ClassKey } from "@/lib/types";
import { rollingClinicWeeks, weekLabel, toISODate, parseISODate } from "@/lib/weeks";
import { AdminSubNav } from "@/components/admin/AdminTopNav";
import { PillLink } from "@/components/ui";
import { TemplateEditor } from "@/components/admin/TemplateEditor";
import { STUDENT_SUB_TABS } from "../subTabs";

export default async function AdminTemplatesPage({
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

  const template = await getClinicTemplate(classKey, selectedWeekStart);

  return (
    <div>
      <AdminSubNav tabs={STUDENT_SUB_TABS} />

      <div className="mt-4 flex flex-wrap gap-2 border-b border-line-soft pb-4">
        {CLASSES.map((c) => (
          <PillLink key={c} href={`/admin/students/templates?class=${c}&week=${selectedWeekISO}`} active={c === classKey}>
            {c}
          </PillLink>
        ))}
      </div>
      <div className="mt-3.5 flex gap-1.5 overflow-x-auto">
        {weeks.map((w) => {
          const iso = toISODate(w);
          return (
            <PillLink key={iso} href={`/admin/students/templates?class=${classKey}&week=${iso}`} active={iso === selectedWeekISO}>
              {weekLabel(w)}
            </PillLink>
          );
        })}
      </div>

      <TemplateEditor
        key={`${classKey}_${selectedWeekISO}`}
        classKey={classKey}
        weekStartISO={selectedWeekISO}
        template={template}
      />
    </div>
  );
}
