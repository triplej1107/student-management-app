import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { requireStaffSession } from "@/lib/authz";
import { getClinicCheck, getClinicTemplate, getStaffById, getStudentById } from "@/lib/data";
import { getOmrSubmissionsForStudentWeek } from "@/lib/clinicOmr";
import { rollingClinicWeeks, weekLabel, toISODate, parseISODate } from "@/lib/weeks";
import { PillLink, EmptyState } from "@/components/ui";
import { resolveBackHref, fromQuery } from "@/lib/backTarget";
import { ClinicChecklistEditor } from "@/components/staff/ClinicChecklistEditor";
import { FeedbackEditor } from "@/components/staff/FeedbackEditor";

export default async function StaffClinicDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ week?: string; from?: string }>;
}) {
  const session = await requireStaffSession();
  const { studentId } = await params;
  const { week, from } = await searchParams;

  const student = await getStudentById(Number(studentId));
  if (!student) notFound();

  const weeks = rollingClinicWeeks(8);
  const selectedWeekStart = week ? parseISODate(week) : weeks[0];
  const selectedWeekISO = toISODate(selectedWeekStart);

  const classKey = student.class_key;
  const [template, check, currentStaff, omrSubmissions] = await Promise.all([
    classKey ? getClinicTemplate(classKey, selectedWeekStart) : null,
    getClinicCheck(student.id, selectedWeekStart),
    getStaffById(session.staffId),
    getOmrSubmissionsForStudentWeek(student.id, selectedWeekISO),
  ]);
  const approvedByStaff = check?.staff_approved_by ? await getStaffById(check.staff_approved_by) : null;

  const today = new Date();
  const todayLabel = `${today.getMonth() + 1}/${today.getDate()}`;

  return (
    <div className="box-border px-5 pt-2 pb-7">
      <BackButton href={resolveBackHref(from, "/staff/clinic", "/staff/clinic-backlog")} />
      <div className="border-b border-line pb-3 pt-1 text-center">
        <div className="text-[19px] font-extrabold text-ink">클리닉 점검표</div>
        <div className="mt-1 text-xs italic text-ink-muted">
          유종의미 종주T · {classKey ?? "미배정"}
        </div>
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
            <PillLink
              key={iso}
              href={`/staff/clinic/${studentId}?week=${iso}${fromQuery(from)}`}
              active={iso === selectedWeekISO}
            >
              {weekLabel(w)}
            </PillLink>
          );
        })}
      </div>

      <div className="mt-3.5 flex justify-between text-[13px]">
        <span className="font-bold text-ink">
          이름 {student.name}
          <span className="ml-1 font-normal text-ink-muted">{student.student_code}</span>
        </span>
        <span className="text-ink-muted">{todayLabel}</span>
      </div>

      {!template && <EmptyState>이 주차는 아직 종주T가 원본을 등록하지 않았어요.</EmptyState>}

      {template && (
        <ClinicChecklistEditor
          key={selectedWeekISO}
          studentId={student.id}
          weekStartISO={selectedWeekISO}
          template={template}
          check={check ?? undefined}
          staffApprovedByName={approvedByStaff?.name ?? null}
          currentStaffName={currentStaff?.name ?? ""}
          zongjuApproved={check?.zongju_approved ?? false}
          omrSubmissions={Object.fromEntries(omrSubmissions)}
        />
      )}

      <FeedbackEditor
        key={`fb_${selectedWeekISO}`}
        studentId={student.id}
        weekStartISO={selectedWeekISO}
        initialTags={check?.feedback_tags ?? null}
        initialText={check?.feedback_text ?? null}
      />
    </div>
  );
}
