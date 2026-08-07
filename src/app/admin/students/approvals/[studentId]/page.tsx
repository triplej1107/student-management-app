import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { requireZongjuSession } from "@/lib/authz";
import {
  getClinicCheck,
  getClinicTemplate,
  getClinicTemplatesForClassWeeks,
  getClinicChecksForStudentWeeks,
  getMakeupForClinicWeek,
  getStaffById,
  getStudentById,
} from "@/lib/data";
import { weekStatus } from "@/lib/clinicProgress";
import { isWeekOnOrAfterEnrollment } from "@/lib/enrollmentWeek";
import type { ClinicTemplate } from "@/lib/types";
import { getOmrSubmissionsForStudentWeek } from "@/lib/clinicOmr";
import { rollingClinicWeeks, weekLabel, toISODate, parseISODate } from "@/lib/weeks";
import { PillLink, EmptyState } from "@/components/ui";
import { resolveBackHref, fromQuery } from "@/lib/backTarget";
import { AdminApprovalChecklist } from "@/components/admin/AdminApprovalChecklist";
import { ZongjuFeedbackEditor } from "@/components/admin/ZongjuFeedbackEditor";
import { ClinicStaffNote } from "@/components/staff/ClinicStaffNote";

export default async function AdminApprovalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ week?: string; from?: string; date?: string; day?: string }>;
}) {
  await requireZongjuSession();
  const { studentId } = await params;
  // date/day는 출결 화면에서 들어왔을 때 보던 날짜·요일 탭으로 되돌아가기 위한 것.
  const { week, from, date, day } = await searchParams;
  const backCtx = { date, day, studentId: Number(studentId) };

  const student = await getStudentById(Number(studentId));
  if (!student) notFound();

  const weeks = rollingClinicWeeks(8);
  const selectedWeekStart = week ? parseISODate(week) : weeks[0];
  const selectedWeekISO = toISODate(selectedWeekStart);

  // 주차 알약을 초록(끝남)/빨강(안 끝남)으로 칠하려면 8주치 상태가 다 필요하다.
  const weekISOs = weeks.map(toISODate);
  const [weekTemplates, weekChecks] = await Promise.all([
    student.class_key
      ? getClinicTemplatesForClassWeeks(student.class_key, weekISOs)
      : new Map<string, ClinicTemplate>(),
    getClinicChecksForStudentWeeks(student.id, weekISOs),
  ]);

  const classKey = student.class_key;
  const [template, check, omrSubmissions, makeup] = await Promise.all([
    classKey ? getClinicTemplate(classKey, selectedWeekStart) : null,
    getClinicCheck(student.id, selectedWeekStart),
    getOmrSubmissionsForStudentWeek(student.id, selectedWeekISO),
    getMakeupForClinicWeek(student.id, selectedWeekStart),
  ]);
  const approvedByStaff = check?.staff_approved_by ? await getStaffById(check.staff_approved_by) : null;

  const today = new Date();
  const todayLabel = `${today.getMonth() + 1}/${today.getDate()}`;

  return (
    <div>
      <BackButton
        href={resolveBackHref(
          from,
          "/admin/students/approvals",
          {
            backlog: "/admin/clinic-backlog",
            attendance: "/admin/students/attendance",
            lecture: "/admin/students/lecture-attendance",
          },
          backCtx
        )}
      />
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
              href={`/admin/students/approvals/${studentId}?week=${iso}${fromQuery(from, backCtx)}`}
              active={iso === selectedWeekISO}
              tone={weekStatus(weekTemplates.get(iso), weekChecks.get(iso), {
                enrolled: isWeekOnOrAfterEnrollment(w, student.first_lesson_date),
              })}
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

      <ClinicStaffNote makeup={makeup} />

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
