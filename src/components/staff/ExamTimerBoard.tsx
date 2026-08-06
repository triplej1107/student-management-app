"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { kstTimeHHMM } from "@/lib/weeks";
import {
  DEFAULT_DURATION_MINUTES,
  WARN_BEFORE_SECONDS,
  finishedMessage,
  formatRemaining,
  remainingSeconds,
  matchStudents,
  timerLevel,
  warningMessage,
  type TimerLevel,
  type TimerStudentOption,
} from "@/lib/examTimerRules";
import type { ExamTimer } from "@/lib/examTimers";
import {
  createTimerAction,
  deleteTimerAction,
  pauseTimerAction,
  resumeTimerAction,
  updateTimerAction,
} from "@/app/staff/timers/actions";

function nowHHMM() {
  return kstTimeHHMM(new Date().toISOString());
}

/** 10분 남으면 노란 칸, 1분 남으면 빨간 칸. 그 사이(5분)는 글자만 빨개진다 —
 * 칸까지 다 빨개지면 정작 1분 남은 학생이 안 보인다. */
const CARD_TONE: Record<TimerLevel, string> = {
  normal: "border-line bg-white",
  warn: "border-warn bg-warn-soft",
  urgent: "border-warn bg-warn-soft",
  critical: "border-danger bg-danger-soft",
  done: "border-danger bg-danger-soft",
};

const TIME_TONE: Record<TimerLevel, string> = {
  normal: "text-ink",
  warn: "text-warn",
  urgent: "text-danger",
  critical: "text-danger",
  done: "text-danger",
};

export function ExamTimerBoard({
  timers,
  students,
}: {
  timers: ExamTimer[];
  students: TimerStudentOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ExamTimer | "new" | null>(null);

  // 1초마다 화면만 다시 그린다. 남은 시간은 항상 시작 시각과 지금 시각의
  // 차이로 계산하므로, 탭이 백그라운드에 있다 돌아와도 어긋나지 않는다.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // 10분 선과 0초 선을 "넘는 순간"만 잡는다. 남은 시간이 그 아래인 걸 그냥
  // 보고 띄우면 새로고침할 때마다 다시 뜬다.
  const prevRemaining = useRef(new Map<number, number>());
  const [warnings, setWarnings] = useState<string[]>([]);
  useEffect(() => {
    const fresh: string[] = [];
    for (const t of timers) {
      const rem = remainingSeconds(
        {
          startAtISO: t.start_at,
          durationSeconds: t.duration_seconds,
          pausedRemainingSeconds: t.paused_remaining_seconds,
        },
        nowMs
      );
      const prev = prevRemaining.current.get(t.id);
      if (prev !== undefined) {
        const crossed = (line: number) => prev > line && rem <= line;
        if (crossed(0)) fresh.push(finishedMessage(t.student_name, t.exam_label));
        else if (crossed(WARN_BEFORE_SECONDS)) {
          fresh.push(warningMessage(t.student_name, t.exam_label));
        }
      }
      prevRemaining.current.set(t.id, rem);
    }
    if (fresh.length > 0) setWarnings((w) => [...w, ...fresh]);
  }, [nowMs, timers]);

  return (
    <div className="mt-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-sm font-bold text-ink">
          타이머
          {timers.length > 0 && (
            <span className="ml-1 font-normal text-ink-muted">{timers.length}명</span>
          )}
        </div>
        <button
          onClick={() => setEditing("new")}
          aria-label="타이머 추가"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[18px] leading-none text-white shadow-[0_2px_8px_rgba(0,86,255,0.35)]"
        >
          +
        </button>
      </div>

      {timers.length === 0 ? (
        <div className="text-[13px] text-ink-muted/70">
          진행 중인 시험이 없어요. 오른쪽 위 + 를 눌러 추가하세요.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {timers.map((t) => (
            <TimerCard key={t.id} timer={t} nowMs={nowMs} onEdit={() => setEditing(t)} />
          ))}
        </div>
      )}

      {editing && (
        <TimerDialog
          timer={editing === "new" ? null : editing}
          students={students}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {warnings.length > 0 && (
        <WarningModal messages={warnings} onClose={() => setWarnings([])} />
      )}
    </div>
  );
}

function TimerCard({
  timer,
  nowMs,
  onEdit,
}: {
  timer: ExamTimer;
  nowMs: number;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const paused = timer.paused_remaining_seconds !== null;
  const rem = remainingSeconds(
    {
      startAtISO: timer.start_at,
      durationSeconds: timer.duration_seconds,
      pausedRemainingSeconds: timer.paused_remaining_seconds,
    },
    nowMs
  );
  const level = timerLevel(rem);

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className={"overflow-hidden rounded-lg border " + CARD_TONE[level]}>
      <div className="truncate px-1 py-1.5 text-center text-[15px] font-extrabold text-ink">
        {timer.student_name}
      </div>
      <div className="flex border-t border-line-soft text-center">
        <div className="flex-1 border-r border-line-soft py-1 text-[11px] text-ink-muted tabular-nums">
          {kstTimeHHMM(timer.start_at)}
        </div>
        <div className={"flex-1 py-1 text-[11px] font-extrabold tabular-nums " + TIME_TONE[level]}>
          {paused ? `⏸ ${formatRemaining(rem)}` : formatRemaining(rem)}
        </div>
      </div>
      <div className="flex border-t border-line-soft text-center text-[10px] font-bold">
        <button
          disabled={pending || !paused}
          onClick={() => run(() => resumeTimerAction(timer.id))}
          className="flex-1 border-r border-line-soft py-1.5 text-accent disabled:text-ink-muted/40"
        >
          시작
        </button>
        <button
          disabled={pending || paused}
          onClick={() => run(() => pauseTimerAction(timer.id))}
          className="flex-1 border-r border-line-soft py-1.5 text-ink-secondary disabled:text-ink-muted/40"
        >
          정지
        </button>
        <button disabled={pending} onClick={onEdit} className="flex-1 py-1.5 text-ink-secondary">
          수정
        </button>
      </div>
    </div>
  );
}

function TimerDialog({
  timer,
  students,
  onClose,
  onDone,
}: {
  timer: ExamTimer | null;
  students: TimerStudentOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState(timer?.student_name ?? "");
  const [examLabel, setExamLabel] = useState(timer?.exam_label ?? "");
  const [startTime, setStartTime] = useState(
    timer ? kstTimeHHMM(timer.start_at) : nowHHMM()
  );
  const [durationMinutes, setDurationMinutes] = useState(
    String(timer ? Math.round(timer.duration_seconds / 60) : DEFAULT_DURATION_MINUTES)
  );
  // 목록에서 고른 직후에는 후보를 닫는다 — 안 그러면 고른 이름으로 다시
  // 검색돼서 방금 누른 항목이 그대로 떠 있는다.
  const [pickedFromList, setPickedFromList] = useState(false);
  const suggestions = pickedFromList ? [] : matchStudents(students, studentName);

  function save() {
    setError(null);
    const input = {
      studentName,
      examLabel,
      startTime,
      durationMinutes: Number(durationMinutes),
    };
    startTransition(async () => {
      try {
        if (timer) await updateTimerAction(timer.id, input);
        else await createTimerAction(input);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "저장하지 못했어요.");
      }
    });
  }

  function remove() {
    if (!timer) return;
    if (!confirm(`${timer.student_name} 타이머를 지울까요?`)) return;
    startTransition(async () => {
      await deleteTimerAction(timer.id);
      onDone();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
      <div className="w-full max-w-[340px] rounded-2xl bg-white p-4 shadow-[0_10px_40px_rgba(20,30,60,0.3)]">
        <div className="mb-3 text-[15px] font-extrabold text-ink">
          {timer ? "타이머 수정" : "타이머 추가"}
        </div>

        <label className="mb-1 block text-[11px] font-bold text-ink-muted">학생 이름</label>
        <div className="relative mb-2.5">
          <input
            value={studentName}
            onChange={(e) => {
              setStudentName(e.target.value);
              setPickedFromList(false);
            }}
            placeholder="예: 이순신"
            autoComplete="off"
            className="w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
          />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-[0_6px_20px_rgba(20,30,60,0.18)]">
              {suggestions.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    setStudentName(s.name);
                    setPickedFromList(true);
                  }}
                  className="flex w-full items-center justify-between px-2.5 py-2 text-left text-[13px] text-ink hover:bg-accent-soft"
                >
                  <span className="font-bold">{s.name}</span>
                  <span className="ml-2 truncate text-[11px] text-ink-muted">
                    {s.detail || s.code}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-2.5 flex gap-2">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-bold text-ink-muted">시작 시간</label>
            <input
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              placeholder="13:30"
              inputMode="numeric"
              className="w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px] tabular-nums"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-bold text-ink-muted">소요 시간(분)</label>
            <input
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="80"
              inputMode="numeric"
              className="w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px] tabular-nums"
            />
          </div>
        </div>

        <label className="mb-1 block text-[11px] font-bold text-ink-muted">
          시험 이름 <span className="font-normal">(선택 · 10분 전 알림에 들어가요)</span>
        </label>
        <input
          value={examLabel}
          onChange={(e) => setExamLabel(e.target.value)}
          placeholder="예: 모의고사 4회차"
          className="w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
        />

        {error && <div className="mt-2 text-[11px] font-semibold text-danger">{error}</div>}

        <div className="mt-3.5 flex gap-2">
          {timer && (
            <button
              onClick={remove}
              disabled={pending}
              className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-xs font-bold text-danger disabled:opacity-50"
            >
              삭제
            </button>
          )}
          <button
            onClick={onClose}
            disabled={pending}
            className="ml-auto rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink-secondary disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={save}
            disabled={pending || !studentName.trim()}
            className="rounded-lg bg-accent px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

function WarningModal({ messages, onClose }: { messages: string[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="w-full max-w-[320px] rounded-2xl bg-white p-5 text-center shadow-[0_10px_40px_rgba(20,30,60,0.3)]">
        <div className="text-[28px]">⏰</div>
        <div className="mt-2 flex flex-col gap-1.5">
          {messages.map((m, i) => (
            <div key={i} className="text-[15px] font-extrabold leading-snug text-ink">
              {m}
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-accent py-2.5 text-[13px] font-bold text-white"
        >
          확인
        </button>
      </div>
    </div>
  );
}
