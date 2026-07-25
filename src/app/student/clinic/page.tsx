import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/authz";
import { getStudentById, getClinicTemplate, getClinicCheck } from "@/lib/data";
import { rollingWeeks, weekLabel, toISODate, parseISODate } from "@/lib/weeks";
import { PillLink, EmptyState, ScreenTitle } from "@/components/ui";
import { ClinicChecklistReadOnly } from "@/components/ClinicChecklistReadOnly";

export default async function StudentClinicPage({
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

  const template = student.class_key
    ? await getClinicTemplate(student.class_key, selectedWeekStart)
    : null;
  const check = await getClinicCheck(student.id, selectedWeekStart);

  return (
    <div className="box-border px-5 pt-2 pb-7">
      <div className="border-b border-line pb-3 text-center">
        <ScreenTitle>클리닉 점검표</ScreenTitle>
        <div className="mt-1 text-xs italic text-ink-muted">유종의미 종주T</div>
        {template && (
          <div className="mt-1.5 text-[13px] font-bold text-ink">
            {weekLabel(selectedWeekStart)}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto">
        {weeks.map((w) => {
          const iso = toISODate(w);
          return (
            <PillLink key={iso} href={`/student/clinic?week=${iso}`} active={iso === selectedWeekISO}>
              {weekLabel(w)}
            </PillLink>
          );
        })}
      </div>

      {!template && <EmptyState>이 주차는 아직 등록된 점검표가 없어요.</EmptyState>}
      {template && <ClinicChecklistReadOnly template={template} check={check ?? undefined} />}
    </div>
  );
}
