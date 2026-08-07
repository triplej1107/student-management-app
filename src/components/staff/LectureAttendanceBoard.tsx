"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DAY_ORDER } from "@/lib/types";
import type { ClassKey } from "@/lib/types";
import { lectureSlotLabel, makeupSlotsFor, type LectureStatus } from "@/lib/lectureRules";
import type { LectureAttendanceEntry } from "@/lib/lectureAttendance";
import { studentAnchorId } from "@/lib/backTarget";
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
  dayLabel,
  entries,
  clinicHrefBase,
  backlogWeeks,
}: {
  dateISO: string;
  /** "토" — 묶음 이름에 쓴다. 화면이 하루치만 보여주므로 하나로 충분하다. */
  dayLabel: string;
  entries: LectureAttendanceEntry[];
  /** 이름을 눌렀을 때 열 점검표 주소의 앞부분 — 조교는 /staff/clinic,
   * 종주T는 /admin/students/approvals. 종주T에게 조교 전용 주소를 주면
   * 권한 검사에 걸려 홈으로 튕긴다. */
  clinicHrefBase: string;
  /** 학생 id → 클리닉이 몇 주 밀렸는지. 밀림이 없는 학생은 키가 없다.
   * Map이 아니라 순수 객체인 이유는 서버 컴포넌트에서 이 클라이언트
   * 컴포넌트로 그대로 넘어가야 하기 때문. */
  backlogWeeks: Record<number, number>;
}) {
  // 반이 아니라 **타임**으로 묶는다. 같은 반이 여러 시간대에 흩어져 있어서
  // 반으로 묶으면 지금 눈앞의 타임을 체크하는 데 도움이 안 된다.
  // entries는 서버에서 이미 시각 순으로 정렬돼 온다.
  const bySlot = new Map<string, LectureAttendanceEntry[]>();
  for (const e of entries) {
    const list = bySlot.get(e.time) ?? [];
    list.push(e);
    bySlot.set(e.time, list);
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

      {Array.from(bySlot.entries()).map(([time, list]) => (
        <div key={time} className="mt-5">
          <div className="mb-2 text-sm font-extrabold text-ink">
            {lectureSlotLabel(dayLabel, time)}
            <span className="ml-1.5 text-xs font-normal text-ink-muted">
              {list.filter((e) => e.status).length}/{list.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {list.map((entry) => (
              <LectureRow
                key={entry.studentId}
                dateISO={dateISO}
                dayLabel={dayLabel}
                entry={entry}
                clinicHrefBase={clinicHrefBase}
                backlogWeeks={backlogWeeks[entry.studentId]}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LectureRow({
  dateISO,
  dayLabel,
  entry,
  clinicHrefBase,
  backlogWeeks,
}: {
  dateISO: string;
  dayLabel: string;
  entry: LectureAttendanceEntry;
  clinicHrefBase: string;
  /** 클리닉이 몇 주 밀렸는지. 밀림이 없으면 undefined. */
  backlogWeeks?: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editingMakeup, setEditingMakeup] = useState(false);
  const [dayDraft, setDayDraft] = useState(entry.makeupDay ?? "");
  const [timeDraft, setTimeDraft] = useState(entry.makeupTime ?? "");
  // 타임표에 없는 곳으로 보내야 할 때만 여는 수동 입력.
  const [manual, setManual] = useState(false);
  const slots = makeupSlotsFor(entry.classKey, dayLabel, entry.time);

  /** 타임 버튼 — 한 번 누르면 바로 저장하고 칸을 닫는다. */
  function pickSlot(day: string, time: string) {
    startTransition(async () => {
      await saveLectureMakeupAction(entry.studentId, dateISO, day, time);
      setEditingMakeup(false);
      showToast(`보강: ${lectureSlotLabel(day, time)}`);
      router.refresh();
    });
  }

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

  // 카드 색은 **클리닉 밀림 전용**이다 — 1주면 노랑, 2주 이상이면 빨강.
  // 보강 필요는 빨간 배지와 위쪽 집계로 따로 알린다: 같은 빨강이 "밀렸다"와
  // "보강 잡아야 한다" 두 가지를 뜻하면 체크하다가 헷갈린다.
  const tone = !backlogWeeks
    ? "border-line-soft bg-white"
    : backlogWeeks >= 2
      ? "border-danger/50 bg-danger-soft"
      : "border-warn/50 bg-warn-soft";

  return (
    // id는 점검표에서 뒤로 돌아올 때 이 카드로 바로 내려오기 위한 앵커.
    <div
      id={studentAnchorId(entry.studentId)}
      className={`scroll-mt-24 rounded-2xl border p-3.5 shadow-[0_3px_14px_rgba(20,30,60,0.12)] ${tone}`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* 이름 쪽을 누르면 점검표로 — 색만 보고 "뭐가 밀렸지" 궁금할 때
            바로 열어보라는 것. 출결 버튼까지 링크로 덮으면 체크가 안 되므로
            왼쪽 정보 칸만 감싼다(클리닉 출결 화면과 같은 방식). */}
        <Link
          href={`${clinicHrefBase}/${entry.studentId}?from=lecture&date=${dateISO}`}
          className="min-w-0 cursor-pointer"
        >
          <div className="text-[15px] font-bold text-ink">
            {entry.name}
            {entry.classKey && (
              <span className="ml-1 text-xs font-normal text-ink-muted">{entry.classKey}</span>
            )}
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
              보강: {lectureSlotLabel(entry.makeupDay, entry.makeupTime)}
            </div>
          )}
          {entry.status && entry.auto && (
            <div className="mt-0.5 text-[11px] text-ink-muted">🤖 키오스크 자동 기록</div>
          )}
        </Link>
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
          {/* 반 타임표가 있으면 손으로 칠 이유가 없다 — 한 번 누르면 바로 저장된다. */}
          {slots.length > 0 && (
            <>
              <div className="mb-1.5 text-xs font-bold text-ink-muted">어느 타임으로 보낼까요?</div>
              <div className="flex flex-wrap gap-1.5">
                {slots.map((slot) => {
                  const picked = entry.makeupDay === slot.day && entry.makeupTime === slot.time;
                  return (
                    <button
                      key={`${slot.day}-${slot.time}`}
                      disabled={pending}
                      onClick={() => pickSlot(slot.day, slot.time)}
                      className={
                        "rounded-lg border px-2.5 py-2 text-xs font-bold " +
                        (picked
                          ? "border-accent bg-accent text-white"
                          : "border-accent/50 bg-accent-soft text-accent")
                      }
                    >
                      {lectureSlotLabel(slot.day, slot.time)}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <button
            onClick={() => setManual((v) => !v)}
            className="mt-2 text-[11px] font-bold text-ink-muted underline"
          >
            {manual ? "타임 목록으로" : "직접 입력"}
          </button>

          {(manual || slots.length === 0) && (
            <div className="mt-1.5">
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
              <button
                onClick={saveMakeup}
                className="mt-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-bold text-white"
              >
                저장
              </button>
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => setEditingMakeup(false)}
              className="text-[11px] font-bold text-ink-secondary underline"
            >
              닫기
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
