import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudentSession } from "@/lib/authz";
import { getStudentById, getClinicTemplate, getClinicCheck, listNoticesForClass } from "@/lib/data";
import { getUjcBalance, getUjcHistory } from "@/lib/ujc";
import { getStudentTier } from "@/lib/ujcTier";
import { getStudentBacklogDetail } from "@/lib/clinicBacklog";
import { getToday } from "@/lib/today";
import { weekLabel } from "@/lib/weeks";
import { EmptyState } from "@/components/ui";
import { ClinicChecklistReadOnly } from "@/components/ClinicChecklistReadOnly";
import { PushSubscribeBanner } from "@/components/PushSubscribeBanner";
import { UjcWalletCard } from "@/components/UjcWalletCard";
import { BacklogWarningModal } from "@/components/BacklogWarningModal";
import { logoutAction } from "@/app/login/actions";

const UJC_REASON_LABEL: Record<string, string> = {
  clinic_complete: "클리닉 완료",
  manual_grant: "지급",
  exchange: "교환",
  reset: "초기화",
};

export default async function StudentHomePage() {
  const session = await requireStudentSession();
  const student = await getStudentById(session.studentId);
  if (!student) notFound();

  const { clinicWeekStart } = getToday();
  const isStudent = session.role === "student";

  const [template, check, notices, balance, tier, history, backlog] = await Promise.all([
    student.class_key ? getClinicTemplate(student.class_key, clinicWeekStart) : null,
    getClinicCheck(student.id, clinicWeekStart),
    student.class_key ? listNoticesForClass(student.class_key, 3) : [],
    isStudent ? getUjcBalance(student.id) : Promise.resolve(null),
    isStudent ? getStudentTier(student.id) : Promise.resolve(null),
    isStudent ? getUjcHistory(student.id, 5) : Promise.resolve([]),
    isStudent ? getStudentBacklogDetail(student.id) : Promise.resolve(null),
  ]);

  return (
    <div className="box-border px-5 pt-2 pb-6">
      <div className="flex items-center justify-between">
        <div className="text-xl font-extrabold text-ink">안녕하세요, {student.name}님</div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-sm text-ink-secondary"
            aria-label="로그아웃"
          >
            ↩
          </button>
        </form>
      </div>

      {isStudent && backlog && (
        <BacklogWarningModal
          key={backlog.oldestIncompleteWeekISO}
          weeksOverdue={backlog.weeksOverdue}
          oldestIncompleteLabel={backlog.oldestIncompleteLabel}
          missingHwLabels={backlog.missingHwLabels}
          missingTestLabels={backlog.missingTestLabels}
        />
      )}

      {(session.role === "student" || session.role === "parent") && <PushSubscribeBanner />}

      {isStudent && balance !== null && (
        <div className="mt-4">
          <UjcWalletCard balance={balance} grade={tier?.grade ?? null} />

          <Link
            href="/student/tier-leaderboard"
            className="mt-2 block text-center text-xs font-bold text-accent"
          >
            리더보드 확인하기 →
          </Link>

          {history.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-xs font-bold text-ink-muted">최근 UJC 내역</div>
              <div className="flex flex-col gap-1.5">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-xl border border-line-soft bg-white px-3 py-2 text-xs"
                  >
                    <div className="text-ink-secondary">
                      {UJC_REASON_LABEL[h.reason_type] ?? h.reason_type}
                      {h.reason_note && <span className="text-ink-muted"> · {h.reason_note}</span>}
                    </div>
                    <div className={"font-bold " + (h.amount >= 0 ? "text-accent" : "text-ink-muted")}>
                      {h.amount >= 0 ? "+" : ""}
                      {h.amount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5">
        <div className="mb-1 text-sm font-bold text-ink">이번주 클리닉 점검표</div>
        <div className="mb-2.5 text-xs text-ink-muted">{weekLabel(clinicWeekStart)}</div>
        {!template && <EmptyState>이번 주는 아직 등록된 점검표가 없어요.</EmptyState>}
        {template && (
          <ClinicChecklistReadOnly
            template={template}
            check={check ?? undefined}
            feedbackText={session.role === "parent" && check?.zongju_approved ? check?.feedback_text : null}
            zongjuFeedbackText={session.role === "parent" ? check?.zongju_feedback_text : null}
          />
        )}
      </div>

      <div className="mt-5">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="text-sm font-bold text-ink">공지사항</div>
          <Link href="/student/notices" className="text-xs font-bold text-accent">
            전체보기 →
          </Link>
        </div>
        {notices.length === 0 && <div className="text-[13px] text-ink-muted/70">등록된 공지가 없어요.</div>}
        {notices.map((n) => (
          <div key={n.id} className="mb-2 rounded-xl border border-line-soft bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-ink">{n.title}</div>
              <div className="text-xs text-ink-muted">{n.notice_date}</div>
            </div>
            {n.content && <div className="mt-1 text-xs leading-relaxed text-ink-secondary">{n.content}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
