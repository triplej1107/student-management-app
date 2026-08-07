"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DAY_ORDER } from "@/lib/types";
import type { ClassKey } from "@/lib/types";
import type { LectureStatus } from "@/lib/lectureRules";
import type { LectureAttendanceEntry } from "@/lib/lectureAttendance";
import { useToast } from "@/components/Toast";
import {
  markLectureAttendanceAction,
  saveLectureMakeupAction,
  cancelLectureMakeupAction,
} from "@/app/staff/lecture-attendance/actions";

const STATUSES: LectureStatus[] = ["출석", "지각", "조정", "결석"];

const STATUS_STYLE: Record<LectureStatus, { border: string; bg: string; color: string }> = {
  출석: { border: "border-success", bg: "bg-success-soft", color: "text-success" },
  지각: { border: "border-warn", bg: "bg-warn-soft", color: "text-warn" },
  조정: { border: "border-accent", bg: "bg-accent-soft", color: "text-accent" },
  결석: { border: "border-danger", bg: "bg-danger-soft", color: "text-danger" },
};
const UNSET_STYLE = { border: "border-line", bg: "bg-white", color: "text-ink-muted" };

/**
 * 강의(주말 정규 수업) 출결 판 — 조교와 종주T가 같은 화면을 본다.
 *
 * 기본값은 맥가이7 키오스크에서 자동으로 들어오고, 안 잡힌 학생은 여기서
 * 직접 누르면 된다. 사람이 누른 건 source='manual'로 남아 다음 동기화가
 * 덮어쓰지 않는다.
 *
 * 클리닉 출결 화면과 거의 같은 조작감으로 맞췄다 — 다른 점은 못 온 학생이
 * "밀림"이 아니라 **"보강"** 으로 잡힌다는 것.
 */
export function LectureAttendanceBoard({
  dateISO,
  entries,
}: {
  dateISO: string;
  entries: LectureAttendanceEntry[];
}) {
  const byClass = new Map<string, LectureAttendanceEntry[]>();
  for (const e of entries) {
    const key = e.classKey ?? "반 미배정";
    const list = byClass.get(key) ?? [];
    list.push(e);
    byClass.set(key, list);
  }

  const checked = entries.filter((e) => e.status).length;
  const makeupNeeded = entries.filter((e) => e.needsMakeup).length;

  if (entries.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-line-soft bg-white p-4 text-[13px] text-ink-muted/70">
        이 날짜에는 강의 수업이 없어요.
      </div>
    );
  }

  return (
    <div>
      <div className="mt-3.5 flex gap-3">
        <div className="flex-1 rounded-2xl border border-line-soft bg-white p-3.5">
          <div className="text-[13px] font-semibold text-ink-muted">체크됨</div>
          <div className="mt-1 text-[22px] font-extrabold text-ink">
            {checked}/{entries.length}명
          </div>
        </div>
        <div className="flex-1 rounded-2xl border border-danger/40 bg-danger-soft p-3.5">
          <div className="text-[13px] font-semibold text-danger">보강 필요</div>
          <div className="mt-1 text-[22px] font-extrabold text-ink">{makeupNeeded}명</div>
        </div>
      </div>

      {Array.from(byClass.entries()).map(([classKey, list]) => (
        <div key={classKey} className="mt-5">
          <div className="mb-2 text-sm font-extrabold text-ink">
            {classKey}
            <span className="ml-1.5 text-xs font-normal text-ink-muted">
              {list.filter((e) => e.status).length}/{list.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {list.map((entry) => (
              <LectureRow key={entry.studentId} dateISO={dateISO} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LectureRow({ dateISO, entry }: { dateISO: string; entry: LectureAttendanceEntry }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editingMakeup, setEditingMakeup] = useState(false);
  const [dayDraft, setDayDraft] = useState(entry.makeupDay ?? "");
  const [timeDraft, setTimeDraft] = useState(entry.makeupTime ?? "");

  function mark(next: LectureStatus) {
    startTransition(async () => {
      await markLectureAttendanceAction(entry.studentId, dateISO, next);
      // 결석이면 보강 일정을 바로 잡을 수 있게 칸을 연다 — 클리닉과 같은 흐름.
      if (next === "결석" || next === "조정") setEditingMakeup(true);
      showToast(`${entry.name} ${next} 처리됨`);
      router.refresh();
    });
  }

  function saveMakeup() {
    if (!dayDraft || !timeDraft.trim()) return;
    startTransition(async () => {
      await saveLectureMakeupAction(entry.studentId, dateISO, dayDraft, timeDraft.trim());
      setEditingMakeup(false);
      showToast("보강 일정 저장됨");
      router.refresh();
    });
  }

  function cancelMakeup() {
    startTransition(async () => {
      await cancelLectureMakeupAction(entry.studentId, dateISO);
      setEditingMakeup(false);
      setDayDraft("");
      setTimeDraft("");
      showToast("보강 일정 삭제됨");
      router.refresh();
    });
  }

  const tone = entry.needsMakeup
    ? "border-danger/50 bg-danger-soft"
    : "border-line-soft bg-white";

  return (
    <div className={`rounded-2xl border p-3.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)] ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-ink">
            {entry.name}
            <span className="ml-1 text-xs font-normal text-ink-muted">{entry.time}</span>
          </div>
          {entry.moved && (
            <div className="mt-0.5 text-[11px] font-bold text-accent">이 주만 옮겨온 학생</div>
          )}
          {entry.needsMakeup && (
            <div className="mt-1 inline-block rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">
              보강 필요
            </div>
          )}
          {entry.makeupDay && entry.makeupTime && (
            <div className="mt-0.5 text-[11px] font-bold text-accent">
              보강: {entry.makeupDay} {entry.makeupTime}
            </div>
          )}
          {entry.status && entry.auto && (
            <div className="mt-0.5 text-[11px] text-ink-muted">🤖 키오스크 자동 기록</div>
          )}
        </div>
        <div className="flex flex-none gap-1">
          {STATUSES.map((s) => {
            const style = entry.status === s ? STATUS_STYLE[s] : UNSET_STYLE;
            return (
              <button
                key={s}
                disabled={pending}
                onClick={() => mark(s)}
                className={`h-9 w-9 rounded-[9px] border text-[12px] font-bold ${style.border} ${style.bg} ${style.color}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {editingMakeup && (
        <div className="mt-2.5 border-t border-line-soft pt-2.5">
          <div className="mb-1.5 text-xs font-bold text-ink-muted">보강 요일/시간</div>
          <div className="flex flex-wrap gap-1.5">
            {DAY_ORDER.map((d) => (
              <button
                key={d}
                onClick={() => setDayDraft(d)}
                className={
                  "rounded-lg border px-2.5 py-1.5 text-xs font-bold " +
                  (dayDraft === d
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-white text-ink-secondary")
                }
              >
                {d}
              </button>
            ))}
          </div>
          <input
            value={timeDraft}
            onChange={(e) => setTimeDraft(e.target.value)}
            placeholder="예: 20:00"
            className="mt-2 w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={saveMakeup}
              className="rounded-lg bg-accent px-3.5 py-2 text-xs font-bold text-white"
            >
              저장
            </button>
            <button
              onClick={() => setEditingMakeup(false)}
              className="rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink-secondary"
            >
              취소
            </button>
            {entry.makeupDay && (
              <button onClick={cancelMakeup} className="text-[11px] font-bold text-danger underline">
                보강 삭제
              </button>
            )}
          </div>
        </div>
      )}

      {!editingMakeup && (entry.needsMakeup || entry.makeupDay) && (
        <button
          onClick={() => setEditingMakeup(true)}
          className="mt-2 text-[11px] font-bold text-ink-muted underline"
        >
          {entry.makeupDay ? "보강 일정 수정" : "보강 일정 잡기"}
        </button>
      )}
    </div>
  );
}

export type { ClassKey };
