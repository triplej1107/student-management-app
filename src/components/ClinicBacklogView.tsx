import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { ClinicContactRow } from "@/components/ClinicContactRow";
import type { ClinicBacklogEntry } from "@/lib/clinicBacklog";
import type { ClinicContactLog } from "@/lib/types";

/** 관리자(/admin/clinic-backlog)와 조교(/staff/clinic-backlog) 양쪽에서
 * 쓰는 밀림 목록 뷰 — 링크 대상과 서버 액션만 페이지별로 주입받는다. */
export function ClinicBacklogView({
  entries,
  contactLogs,
  detailHref,
  toggleAction,
  saveNoteAction,
}: {
  entries: ClinicBacklogEntry[];
  contactLogs: Map<number, ClinicContactLog>;
  detailHref: (entry: ClinicBacklogEntry) => string;
  toggleAction: (studentId: number, contacted: boolean) => Promise<void>;
  saveNoteAction: (studentId: number, note: string) => Promise<void>;
}) {
  const oneWeek = entries.filter((e) => e.weeksOverdue === 1);
  const twoPlus = entries.filter((e) => e.weeksOverdue >= 2);

  // 2주+ 미확인을 최상단에, 연락 완료된 2주+는 그다음, 1주 밀림은 마지막에.
  function rank(e: ClinicBacklogEntry) {
    if (e.weeksOverdue < 2) return 0;
    return contactLogs.get(e.studentId)?.contacted ? 1 : 2;
  }
  const sorted = [...entries].sort((a, b) => {
    const r = rank(b) - rank(a);
    return r !== 0 ? r : b.weeksOverdue - a.weeksOverdue;
  });

  return (
    <div>
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
              <Link href={detailHref(e)} className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-ink">
                    {e.studentName} <span className="font-normal text-ink-muted">· {e.classKey}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-secondary">{e.oldestIncompleteLabel}부터 미완료</div>
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
                  toggleAction={toggleAction}
                  saveNoteAction={saveNoteAction}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
