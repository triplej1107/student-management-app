import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { requireZongjuSession } from "@/lib/authz";
import { getClinicCheck, getClinicTemplate, getStaffById, getStudentById } from "@/lib/data";
import { getOmrSubmissionsForStudentWeek } from "@/lib/clinicOmr";
import { rollingClinicWeeks, weekLabel, toISODate, parseISODate } from "@/lib/weeks";
import { PillLink, EmptyState } from "@/components/ui";
import { resolveBackHref, fromQuery } from "@/lib/backTarget";
import { AdminApprovalChecklist } from "@/components/admin/AdminApprovalChecklist";
import { ZongjuFeedbackEditor } from "@/components/admin/ZongjuFeedbackEditor";

export default async function AdminApprovalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ week?: string; from?: string }>;
}) {
  await requireZongjuSession();
  const { studentId } = await params;
  const { week, from } = await searchParams;

  const student = await getStudentById(Number(studentId));
  if (!student) notFound();

  const weeks = rollingClinicWeeks(8);
  const selectedWeekStart = week ? parseISODate(week) : weeks[0];
  const selectedWeekISO = toISODate(selectedWeekStart);

  const classKey = student.class_key;
  const [template, check, omrSubmissions] = await Promise.all([
    classKey ? getClinicTemplate(classKey, selectedWeekStart) : null,
    getClinicCheck(student.id, selectedWeekStart),
    getOmrSubmissionsForStudentWeek(student.id, selectedWeekISO),
  ]);
  const approvedByStaff = check?.staff_approved_by ? await getStaffById(check.staff_approved_by) : null;

  const today = new Date();
  const todayLabel = `${today.getMonth() + 1}/${today.getDate()}`;

  return (
    <div>
      <BackButton href={resolveBackHref(from, "/admin/students/approvals", "/admin/clinic-backlog")} />
      <div className="border-b border-line pb-3 pt-1 text-center">
        <div className="text-[19px] font-extrabold text-ink">클리닉 점검표</div>
        <div className="mt-1 text-xs italic text-ink-muted">{classKey ?? "미배정"}</div>
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
              href={`/admin/students/approvals/${studentId}?week=${iso}${fromQuery(from)}`}
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

      {!template && <EmptyState>이 주차는 아직 원본을 등록하지 않았어요.</EmptyState>}

      {template && (
        <AdminApprovalChecklist
          key={selectedWeekISO}
          studentId={student.id}
          weekStartISO={selectedWeekISO}
          template={template}
          check={check ?? undefined}
          staffApprovedByName={approvedByStaff?.name ?? null}
          omrSubmissions={Object.fromEntries(omrSubmissions)}
        />
      )}

      <ZongjuFeedbackEditor
        key={`zfb_${selectedWeekISO}`}
        studentId={student.id}
        weekStartISO={selectedWeekISO}
        initialText={check?.zongju_feedback_text ?? null}
      />
    </div>
  );
}
