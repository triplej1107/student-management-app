"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import type { ReminderWithStudent, Student } from "@/lib/types";
import {
  createReminderAction,
  deleteReminderAction,
  updateReminderAction,
} from "@/app/admin/staff/reminders/actions";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d} (${DAY_LABELS[new Date(y, m - 1, d).getDay()]})`;
}

/** 오늘 날짜를 "YYYY-MM-DD"로 — 새 항목 입력칸의 기본값. 연도를 매번 고르지
 * 않아도 되도록 미리 채워두고, 월·일만 바꾸면 되게 한다. */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Draft {
  date: string;
  time: string;
  content: string;
  studentId: number | null;
  studentName: string;
}

const emptyDraft = (): Draft => ({
  date: todayISO(),
  time: "",
  content: "",
  studentId: null,
  studentName: "",
});

export function ReminderManager({
  reminders,
  students,
}: {
  reminders: ReminderWithStudent[];
  students: Pick<Student, "id" | "name" | "school" | "grade">[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createReminderAction(draft.date, draft.time, draft.content, draft.studentId);
        setDraft(emptyDraft());
        showToast("잊지마 항목이 추가됐어요");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "추가하지 못했어요.");
      }
    });
  }

  function startEdit(r: ReminderWithStudent) {
    setEditingId(r.id);
    setEditDraft({
      date: r.event_date,
      time: r.event_time,
      content: r.content,
      studentId: r.student_id,
      studentName: r.studentName ?? "",
    });
  }

  function saveEdit(id: number) {
    startTransition(async () => {
      try {
        await updateReminderAction(id, editDraft.date, editDraft.time, editDraft.content, editDraft.studentId);
        setEditingId(null);
        showToast("수정됐어요");
        router.refresh();
      } catch (e) {
        showToast(e instanceof Error ? e.message : "수정하지 못했어요.", "error");
      }
    });
  }

  function remove(id: number) {
    if (!confirm("이 잊지마 항목을 삭제할까요?")) return;
    startTransition(async () => {
      await deleteReminderAction(id);
      showToast("삭제됐어요");
      router.refresh();
    });
  }

  return (
    <div>
      <div className="rounded-2xl border border-line-soft bg-white p-3.5">
        <div className="mb-2 text-sm font-extrabold text-ink">새 잊지마 항목</div>
        <DraftFields draft={draft} onChange={setDraft} students={students} />
        {error && <div className="mt-1.5 text-[11px] font-semibold text-danger">{error}</div>}
        <button
          onClick={submit}
          disabled={pending}
          className="mt-2 w-full rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white shadow-[0_3px_14px_rgba(20,30,60,0.12)] disabled:opacity-50"
        >
          {pending ? "추가 중..." : "추가"}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {reminders.length === 0 && (
          <div className="text-[13px] text-ink-muted/70">등록된 잊지마 항목이 없어요.</div>
        )}
        {reminders.map((r) =>
          editingId === r.id ? (
            <div key={r.id} className="rounded-xl border border-accent bg-accent-soft/30 p-3">
              <div className="mb-2 text-xs font-bold text-accent">수정 중</div>
              <DraftFields draft={editDraft} onChange={setEditDraft} students={students} />
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => saveEdit(r.id)}
                  disabled={pending}
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  저장
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-xs font-bold text-ink-secondary"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-line-soft bg-white p-3"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-ink">
                  {formatDate(r.event_date)} {r.event_time}
                  {r.studentName && (
                    <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent">
                      {r.studentName}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[13px] text-ink-secondary">{r.content}</div>
              </div>
              <div className="flex flex-none gap-1">
                <button
                  onClick={() => startEdit(r)}
                  className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink-secondary"
                >
                  수정
                </button>
                <button
                  onClick={() => remove(r.id)}
                  className="rounded-lg border border-danger-soft bg-danger-soft px-2.5 py-1.5 text-[11px] font-bold text-danger"
                >
                  삭제
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function DraftFields({
  draft,
  onChange,
  students,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  students: Pick<Student, "id" | "name" | "school" | "grade">[];
}) {
  const query = draft.studentName.trim();
  // 이미 고른 학생이면 후보를 다시 띄우지 않는다 — 고른 뒤에도 목록이 남으면
  // 계속 눌러야 할 것처럼 보이기 때문.
  const matches =
    query && draft.studentId === null
      ? students
          .filter((s) => s.name.includes(query) || (s.school ?? "").includes(query))
          .slice(0, 6)
      : [];

  return (
    <>
      <div className="flex gap-1.5">
        <input
          type="date"
          value={draft.date}
          onChange={(e) => onChange({ ...draft, date: e.target.value })}
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <input
          type="time"
          step={3600}
          value={draft.time}
          onChange={(e) => onChange({ ...draft, time: e.target.value })}
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
      </div>

      <div className="relative mt-1.5">
        <input
          value={draft.studentName}
          onChange={(e) => onChange({ ...draft, studentName: e.target.value, studentId: null })}
          placeholder="학생 연결 (선택) — 이름으로 검색"
          className={
            "w-full box-border rounded-lg border px-2.5 py-2 text-xs " +
            (draft.studentId !== null ? "border-accent bg-accent-soft/40 font-bold text-accent" : "border-line")
          }
        />
        {draft.studentId !== null && (
          <button
            onClick={() => onChange({ ...draft, studentId: null, studentName: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-ink-muted"
          >
            해제
          </button>
        )}
        {matches.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-white shadow-[0_3px_14px_rgba(20,30,60,0.18)]">
            {matches.map((s) => (
              <button
                key={s.id}
                onClick={() => onChange({ ...draft, studentId: s.id, studentName: s.name })}
                className="flex w-full items-center justify-between px-2.5 py-2 text-left text-xs hover:bg-bg-page"
              >
                <span className="font-bold text-ink">{s.name}</span>
                <span className="text-[11px] text-ink-muted">
                  {s.school ?? ""} {s.grade ? `${s.grade}학년` : ""}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {draft.studentId !== null && (
        <div className="mt-1 text-[11px] leading-relaxed text-warn">
          연결하면 이 학생·학부모에게도 알림이 가고 학생 홈 화면에 <b>내용이 그대로</b> 보여요.
        </div>
      )}

      <textarea
        value={draft.content}
        onChange={(e) => onChange({ ...draft, content: e.target.value })}
        placeholder="내용 (예: 영상보강, 태블릿과 이어폰 미리 준비)"
        className="mt-1.5 min-h-[52px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-[13px]"
      />
    </>
  );
}
