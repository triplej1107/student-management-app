import Link from "next/link";
import { requireZongjuSession } from "@/lib/authz";
import { getClinicBacklog, currentBacklogEvalWeek } from "@/lib/clinicBacklog";
import { getClinicContactLogs } from "@/lib/clinicContactLog";
import { EmptyState } from "@/components/ui";
import { ClinicContactRow } from "@/components/admin/ClinicContactRow";

export default async function ClinicBacklogPage() {
  await requireZongjuSession();
  const entries = await getClinicBacklog();

  const oneWeek = entries.filter((e) => e.weeksOverdue === 1);
  const twoPlus = entries.filter((e) => e.weeksOverdue >= 2);

  const contactLogs = await getClinicContactLogs(
    currentBacklogEvalWeek(),
    twoPlus.map((e) => e.studentId)
  );

  // 2주+ 밀림 중 아직 연락 안 한 학생을 최상단에, 그다음 연락 완료된
  // 2주+, 마지막으로 1주 밀림(자동 푸시 대상) 순으로 노출.
  function rank(e: (typeof entries)[number]) {
    if (e.weeksOverdue < 2) return 0;
    return contactLogs.get(e.studentId)?.contacted ? 1 : 2;
  }
  const sorted = [...entries].sort((a, b) => {
    const r = rank(b) - rank(a);
    return r !== 0 ? r : b.weeksOverdue - a.weeksOverdue;
  });

  return (
    <div>
      <div className="mt-4 text-[19px] font-extrabold text-ink">클리닉 밀림 관리</div>
      <div className="mt-1 text-xs text-ink-muted">
        밀린 주차 수가 많은 순으로 정렬돼요. 1주 밀림은 학생에게 자동으로 웹 푸시가 발송되고,
        2주 이상 밀리면 전화 연락이 필요해요.
      </div>

      <div className="mt-4 flex gap-3">
        <div className="flex-1 rounded-2xl border border-warn/40 bg-warn-soft p-3.5">
          <div className="text-[13px] font-semibold text-warn">1주 밀림</div>
          <div className="mt-1 text-[22px] font-extrabold text-ink">{oneWeek.length}명</div>
        </div>
        <div className="flex-1 rounded-2xl border border-danger/40 bg-danger-soft p-3.5">
          <div className="text-[13px] font-semibold text-danger">2주 이상 밀림</div>
          <div className="mt-1 text-[22px] font-extrabold text-ink">{twoPlus.length}명</div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {sorted.length === 0 && <EmptyState>밀린 학생이 없어요.</EmptyState>}
        {sorted.map((e) => {
          const overdue2plus = e.weeksOverdue >= 2;
          const log = contactLogs.get(e.studentId);
          return (
            <div
              key={e.studentId}
              className={
                "rounded-2xl border p-3.5 " +
                (overdue2plus ? "border-danger/40 bg-danger-soft" : "border-warn/40 bg-warn-soft")
              }
            >
              <Link
                href={`/admin/students/approvals/${e.studentId}?week=${e.oldestIncompleteWeekISO}`}
                className="flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-bold text-ink">
                    {e.studentName} <span className="font-normal text-ink-muted">· {e.classKey}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-secondary">
                    {e.oldestIncompleteLabel}부터 미완료
                  </div>
                </div>
                <span
                  className={
                    "rounded-full px-2.5 py-1 text-xs font-bold " +
                    (overdue2plus ? "bg-danger text-white" : "bg-warn text-white")
                  }
                >
                  {e.weeksOverdue}주 밀림
                </span>
              </Link>
              {overdue2plus && (
                <ClinicContactRow
                  studentId={e.studentId}
                  initialContacted={log?.contacted ?? false}
                  initialNote={log?.note ?? null}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
