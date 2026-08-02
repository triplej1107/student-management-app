import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/authz";
import { getStudentById, getClinicTemplate, getClinicCheck } from "@/lib/data";
import { rollingClinicWeeks, weekLabel, toISODate, parseISODate, kstToday, nowKST } from "@/lib/weeks";
import { isWeeklyContentPublished } from "@/lib/weeklyContentVisibility";
import { PillLink, EmptyState, ScreenTitle } from "@/components/ui";
import { ClinicChecklistReadOnly } from "@/components/ClinicChecklistReadOnly";
import { TabSeenBeacon } from "@/components/TabSeenBeacon";

export default async function StudentClinicPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await requireStudentSession();
  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const { week } = await searchParams;
  // 수업 내용과 같은 규칙 — 공개 시각(그 주 일요일 22시)이 지난 주차만
  // 보여준다. 종주T가 주말에 미리 써둔 다음 주 점검표는 목록에도 안 뜨고,
  // 주소를 직접 쳐서 들어와도 아래에서 다시 막는다.
  const todayISO = toISODate(kstToday());
  const kstHour = nowKST().getUTCHours();
  const weeks = rollingClinicWeeks(8).filter((w) =>
    isWeeklyContentPublished(toISODate(w), todayISO, kstHour)
  );
  const selectedWeekStart = week ? parseISODate(week) : weeks[0];
  const selectedWeekISO = selectedWeekStart ? toISODate(selectedWeekStart) : "";
  const selectedPublished =
    !!selectedWeekISO && isWeeklyContentPublished(selectedWeekISO, todayISO, kstHour);

  const [template, check] = await Promise.all([
    selectedPublished && student.class_key
      ? getClinicTemplate(student.class_key, selectedWeekStart)
      : null,
    selectedPublished ? getClinicCheck(student.id, selectedWeekStart) : null,
  ]);

  return (
    <div className="box-border px-5 pt-2 pb-7">
      <TabSeenBeacon tab="clinic" />
      <div className="border-b border-line pb-3 text-center">
        <ScreenTitle>클리닉 점검표</ScreenTitle>
        <div className="mt-1 text-xs italic text-ink-muted">유종의미 종주T</div>
        {template && selectedWeekStart && (
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

      {!selectedPublished && (
        <div className="mt-6 text-center text-[13px] text-ink-muted/70">
          이 주차 점검표는 아직 공개 전이에요.
        </div>
      )}
      {selectedPublished && !template && (
        <EmptyState>이 주차는 아직 등록된 점검표가 없어요.</EmptyState>
      )}
      {template && (
        <ClinicChecklistReadOnly
          template={template}
          check={check ?? undefined}
          feedbackText={session.role === "parent" && check?.zongju_approved ? check?.feedback_text : null}
          zongjuFeedbackText={session.role === "parent" ? check?.zongju_feedback_text : null}
        />
      )}
    </div>
  );
}
