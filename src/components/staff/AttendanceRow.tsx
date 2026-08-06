"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DAY_ORDER } from "@/lib/types";
import type { AttendanceStatus, MakeupSchedule, Student } from "@/lib/types";
import { classDayTimeTag } from "@/lib/weeks";
import { useToast } from "@/components/Toast";
import {
  markAttendanceAction,
  clearAttendanceAction,
  saveMakeupAction,
  cancelMakeupAction,
} from "@/app/staff/attendance/actions";

const STATUS_STYLE: Record<
  AttendanceStatus,
  { border: string; bg: string; color: string }
> = {
  출석: { border: "border-success", bg: "bg-success-soft", color: "text-success" },
  지각: { border: "border-warn", bg: "bg-warn-soft", color: "text-warn" },
  조정: { border: "border-accent", bg: "bg-accent-soft", color: "text-accent" },
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
  autoMarked,
  clinicHrefBase,
  backlogWeeks,
}: {
  student: Student;
  effTime: string;
  hasMakeup: boolean;
  makeup?: MakeupSchedule;
  status?: AttendanceStatus;
  dateISO: string;
  /** 이름을 눌렀을 때 열 점검표 주소의 앞부분 — 조교는 /staff/clinic,
   * 종주T는 /admin/students/approvals. 종주T에게 조교 전용 주소를 주면
   * 권한 검사에 걸려 홈으로 튕긴다. */
  clinicHrefBase: string;
  /** 클리닉이 몇 주 밀렸는지 (밀림 관리 탭과 같은 판정). 밀림이 없으면 undefined.
   * 1주면 카드 전체가 노란색, 2주 이상이면 빨간색으로 떠서 출결 체크하다가
   * 바로 눈에 걸린다. */
  backlogWeeks?: number;
  /** 이 status가 사람이 아니라 시스템이 자동으로 기록한 것 — 클리닉 시각이
   * 지나도록 미출석이면 자동 "지각"으로, 그 지각이 밤까지 안 고쳐지면
   * 자동 "결석"으로 표시된다. 출석/지각/결석 버튼을 실제로 누르면 바로 꺼진다. */
  autoMarked?: boolean;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editingMakeup, setEditingMakeup] = useState(false);
  const [editingStatus, setEditingStatus] = useState<AttendanceStatus | null>(null);
  const [dayDraft, setDayDraft] = useState(makeup?.makeup_day ?? "");
  const [timeDraft, setTimeDraft] = useState(makeup?.makeup_time ?? "");
  const [noteDraft, setNoteDraft] = useState(makeup?.note ?? "");
  const classTag = classDayTimeTag(student.class_day, student.class_time);
  const backlogTone =
    !backlogWeeks
      ? "border-line-soft bg-white"
      : backlogWeeks >= 2
        ? "border-danger/50 bg-danger-soft"
        : "border-warn/50 bg-warn-soft";

  function mark(next: AttendanceStatus) {
    if (status === next) {
      startTransition(async () => {
        await clearAttendanceAction(student.id, dateISO);
        showToast(`${student.name} 출결 취소됨`);
        router.refresh();
      });
      return;
    }
    startTransition(async () => {
      await markAttendanceAction(student.id, dateISO, next);
      if (next === "지각" || next === "조정" || next === "결석") {
        setEditingStatus(next);
        setEditingMakeup(true);
      }
      showToast(`${student.name} ${next} 처리됨`);
      router.refresh();
    });
  }

  function saveMakeup() {
    if (!dayDraft || !timeDraft.trim()) return;
    startTransition(async () => {
      await saveMakeupAction(
        student.id,
        dateISO,
        dayDraft,
        timeDraft.trim(),
        editingStatus ?? status ?? "결석",
        editingStatus === "조정" ? noteDraft.trim() : undefined
      );
      setEditingMakeup(false);
      showToast("대체 일정 저장됨");
      router.refresh();
    });
  }

  function cancelMakeup() {
    startTransition(async () => {
      await cancelMakeupAction(student.id, dateISO);
      setEditingMakeup(false);
      setDayDraft("");
      setTimeDraft("");
      setNoteDraft("");
      showToast("대체 일정 삭제됨");
      router.refresh();
    });
  }

  return (
    <div
      className={`rounded-2xl border p-3.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)] ${backlogTone}`}
    >
      <div className="flex items-start justify-between">
        <Link href={`${clinicHrefBase}/${student.id}?from=attendance`} className="cursor-pointer">
          <div className="text-[15px] font-bold text-ink">
            {student.name}
            {classTag && <span className="text-xs font-normal text-ink-muted">({classTag})</span>}
          </div>
          <div className="mt-0.5 text-xs text-ink-muted">
            {effTime}
            {(student.school || student.grade) &&
              ` · ${[student.school, student.grade ? `${student.grade}학년` : null].filter(Boolean).join(" ")}`}
          </div>
          {!!backlogWeeks && (
            <div
              className={
                "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold text-white " +
                (backlogWeeks >= 2 ? "bg-danger" : "bg-warn")
              }
            >
              클리닉 {backlogWeeks}주 밀림
            </div>
          )}
          {hasMakeup && (
            <div className="mt-0.5 text-[11px] font-bold text-accent">
              대체: {makeup?.makeup_day} {makeup?.makeup_time}
            </div>
          )}
          {hasMakeup && makeup?.note && (
            <div className="mt-0.5 text-[11px] text-ink-muted">전달사항: {makeup.note}</div>
          )}
          {status && autoMarked && (
            <div className="mt-0.5 text-[11px] font-bold text-warn">
              ⏰ 자동 {status} 처리됨 · 확인 필요
            </div>
          )}
        </Link>
        <div className="flex flex-none flex-col items-end gap-1">
          <div className="flex gap-1">
            {(["출석", "지각", "조정", "결석"] as AttendanceStatus[]).map((s) => {
              const style = status === s ? STATUS_STYLE[s] : UNSET_STYLE;
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
                  "rounded-lg border px-2.5 py-1.5 text-xs font-bold shadow-[0_1px_4px_rgba(20,30,60,0.10)] " +
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
          </div>
          {editingStatus === "조정" && (
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="다음 조교에게 전달사항"
              className="mt-2 min-h-[52px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
            />
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={saveMakeup}
              className="rounded-lg bg-accent px-3.5 py-2 text-xs font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
            >
              저장
            </button>
            <button
              onClick={() => setEditingMakeup(false)}
              className="rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink-secondary shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
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
            setNoteDraft(makeup?.note ?? "");
            setEditingStatus(status ?? null);
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
