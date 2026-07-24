"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DAY_ORDER } from "@/lib/types";
import type { AttendanceStatus, MakeupSchedule, Student } from "@/lib/types";
import {
  markAttendanceAction,
  saveMakeupAction,
  cancelMakeupAction,
} from "@/app/staff/attendance/actions";

const STATUS_STYLE: Record<
  AttendanceStatus,
  { border: string; bg: string; color: string }
> = {
  출석: { border: "border-success", bg: "bg-success-soft", color: "text-success" },
  지각: { border: "border-warn", bg: "bg-warn-soft", color: "text-warn" },
  결석: { border: "border-danger", bg: "bg-danger-soft", color: "text-danger" },
};
const UNSET_STYLE = { border: "border-line", bg: "bg-white", color: "text-ink-muted" };

export function AttendanceRow({
  student,
  effTime,
  hasMakeup,
  makeup,
  status,
  dateISO,
}: {
  student: Student;
  effTime: string;
  hasMakeup: boolean;
  makeup?: MakeupSchedule;
  status?: AttendanceStatus;
  dateISO: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingMakeup, setEditingMakeup] = useState(false);
  const [dayDraft, setDayDraft] = useState(makeup?.makeup_day ?? "");
  const [timeDraft, setTimeDraft] = useState(makeup?.makeup_time ?? "");

  function mark(next: AttendanceStatus) {
    startTransition(async () => {
      await markAttendanceAction(student.id, dateISO, next);
      if (next === "지각" || next === "결석") {
        setEditingMakeup(true);
      }
      router.refresh();
    });
  }

  function saveMakeup() {
    if (!dayDraft || !timeDraft.trim()) return;
    startTransition(async () => {
      await saveMakeupAction(student.id, dateISO, dayDraft, timeDraft.trim());
      setEditingMakeup(false);
      router.refresh();
    });
  }

  function cancelMakeup() {
    startTransition(async () => {
      await cancelMakeupAction(student.id, dateISO);
      setEditingMakeup(false);
      setDayDraft("");
      setTimeDraft("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-3.5">
      <div className="flex items-center justify-between">
        <Link href={`/staff/clinic/${student.id}`} className="cursor-pointer">
          <div className="text-[15px] font-bold text-ink">{student.name}</div>
          <div className="mt-0.5 text-xs text-ink-muted">{effTime}</div>
          {hasMakeup && (
            <div className="mt-0.5 text-[11px] font-bold text-accent">
              대체: {makeup?.makeup_day} {makeup?.makeup_time}
            </div>
          )}
        </Link>
        <div className="flex gap-1.5">
          {(["출석", "지각", "결석"] as AttendanceStatus[]).map((s) => {
            const style = status === s ? STATUS_STYLE[s] : UNSET_STYLE;
            return (
              <button
                key={s}
                disabled={pending}
                onClick={() => mark(s)}
                className={`h-9 w-11 rounded-[9px] border text-[13px] font-bold ${style.border} ${style.bg} ${style.color}`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {editingMakeup && (
        <div className="mt-2.5 border-t border-line-soft pt-2.5">
          <div className="mb-1.5 text-xs font-bold text-ink-muted">대체 요일/시간</div>
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
          <div className="mt-2 flex items-center gap-2">
            <input
              value={timeDraft}
              onChange={(e) => setTimeDraft(e.target.value)}
              placeholder="예: 20:00"
              className="flex-1 rounded-lg border border-line px-2.5 py-2 text-[13px]"
            />
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
          </div>
          {hasMakeup && (
            <button
              onClick={cancelMakeup}
              className="mt-2 text-[11px] font-bold text-danger underline"
            >
              대체 일정 삭제
            </button>
          )}
        </div>
      )}

      {!editingMakeup && hasMakeup && (
        <button
          onClick={() => {
            setDayDraft(makeup?.makeup_day ?? "");
            setTimeDraft(makeup?.makeup_time ?? "");
            setEditingMakeup(true);
          }}
          className="mt-2 text-[11px] font-bold text-ink-muted underline"
        >
          대체 일정 수정
        </button>
      )}
    </div>
  );
}
