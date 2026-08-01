"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { ClinicContactRow } from "@/components/ClinicContactRow";
import { ClinicClearButton } from "@/components/ClinicClearButton";
import type { ClinicBacklogEntry } from "@/lib/clinicBacklog";
import type { ClinicContactLog } from "@/lib/types";

/** 관리자(/admin/clinic-backlog)와 조교(/staff/clinic-backlog) 양쪽에서
 * 쓰는 밀림 목록 뷰 — 링크 대상과 서버 액션만 페이지별로 주입받는다.
 * clearAction/bulkClearAction은 종주T 전용 기능이라 admin 쪽에서만
 * 넘겨준다 (undefined면 체크박스·버튼 자체가 안 보임). */
export function ClinicBacklogView({
  entries,
  contactLogs,
  detailHrefBase,
  toggleAction,
  saveNoteAction,
  clearAction,
  bulkClearAction,
}: {
  entries: ClinicBacklogEntry[];
  contactLogs: Map<number, ClinicContactLog>;
  /** 학생 상세 링크 접두어 — 실제 href는 `${detailHrefBase}/${studentId}?week=${weekISO}`.
   * (서버 컴포넌트에서 클라이언트 컴포넌트로는 함수를 못 넘기므로 문자열로 받는다.) */
  detailHrefBase: string;
  toggleAction: (studentId: number, contacted: boolean) => Promise<void>;
  saveNoteAction: (studentId: number, note: string) => Promise<void>;
  clearAction?: (studentId: number, weekStartISO: string) => Promise<void>;
  bulkClearAction?: (entries: { studentId: number; weekStartISO: string }[]) => Promise<void>;
}) {
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggleSelected(studentId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function bulkClear() {
    if (!bulkClearAction || selected.size === 0) return;
    const targets = entries
      .filter((e) => selected.has(e.studentId))
      .map((e) => ({ studentId: e.studentId, weekStartISO: e.oldestIncompleteWeekISO }));
    const ok = window.confirm(`선택한 ${targets.length}명의 밀림을 한번에 청산할까요?`);
    if (!ok) return;
    startTransition(async () => {
      await bulkClearAction(targets);
      setSelected(new Set());
      showToast(`${targets.length}명 밀림 청산됨`);
    });
  }

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

      {bulkClearAction && selected.size > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-accent bg-accent-soft p-3">
          <div className="text-xs font-bold text-accent">{selected.size}명 선택됨</div>
          <button
            onClick={bulkClear}
            disabled={pending}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
          >
            선택 청산
          </button>
        </div>
      )}

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
              <div className="flex items-center gap-2.5">
                {bulkClearAction && (
                  <input
                    type="checkbox"
                    checked={selected.has(e.studentId)}
                    onChange={() => toggleSelected(e.studentId)}
                    className="h-4 w-4 flex-none"
                    aria-label={`${e.studentName} 선택`}
                  />
                )}
                <Link
                  href={`${detailHrefBase}/${e.studentId}?week=${e.oldestIncompleteWeekISO}&from=backlog`}
                  className="flex flex-1 items-center justify-between"
                >
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
              </div>
              {overdue2plus && (
                <ClinicContactRow
                  studentId={e.studentId}
                  initialContacted={log?.contacted ?? false}
                  initialNote={log?.note ?? null}
                  toggleAction={toggleAction}
                  saveNoteAction={saveNoteAction}
                />
              )}
              {clearAction && (
                <ClinicClearButton
                  studentId={e.studentId}
                  weekStartISO={e.oldestIncompleteWeekISO}
                  studentName={e.studentName}
                  weekLabel={e.oldestIncompleteLabel}
                  clearAction={clearAction}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
