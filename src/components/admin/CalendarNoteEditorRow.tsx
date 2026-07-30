"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CLASSES, type CalendarNote, type ClassKey } from "@/lib/types";
import { useToast } from "@/components/Toast";
import {
  updateCalendarNoteContentAction,
  updateCalendarNoteClassesAction,
  updateCalendarNoteRangeAction,
  deleteCalendarNoteAction,
} from "@/app/admin/students/calendar/actions";

export function CalendarNoteEditorRow({ note }: { note: CalendarNote }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [startDate, setStartDate] = useState(note.note_date);
  const [endDate, setEndDate] = useState(note.end_date);
  const [classKeys, setClassKeys] = useState<ClassKey[]>(note.class_keys ?? []);
  const [content, setContent] = useState(note.content);

  function commitContent(value: string) {
    startTransition(async () => {
      await updateCalendarNoteContentAction(note.id, value);
      showToast("저장됨");
      router.refresh();
    });
  }

  function toggleClass(c: (typeof CLASSES)[number]) {
    const next = classKeys.includes(c) ? classKeys.filter((k) => k !== c) : [...classKeys, c];
    setClassKeys(next);
    startTransition(async () => {
      await updateCalendarNoteClassesAction(note.id, next);
      showToast("저장됨");
      router.refresh();
    });
  }

  function commitRange(nextStart: string, nextEnd: string) {
    startTransition(async () => {
      await updateCalendarNoteRangeAction(note.id, nextStart, nextEnd);
      showToast("저장됨");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteCalendarNoteAction(note.id);
      showToast("메모 삭제됨");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-line-soft bg-white p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          onBlur={(e) => commitRange(e.target.value, endDate)}
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <span className="text-xs text-ink-muted">~</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          onBlur={(e) => commitRange(startDate, e.target.value)}
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <button
          onClick={remove}
          className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-xs font-bold text-danger shadow-[0_3px_14px_rgba(20,30,60,0.12)]"
        >
          삭제
        </button>
      </div>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        <button
          onClick={() => {
            setClassKeys([]);
            startTransition(async () => {
              await updateCalendarNoteClassesAction(note.id, []);
              showToast("저장됨");
              router.refresh();
            });
          }}
          className={
            "rounded-lg border px-2.5 py-1.5 text-xs font-bold shadow-[0_1px_4px_rgba(20,30,60,0.10)] " +
            (classKeys.length === 0
              ? "border-accent bg-accent-soft text-accent"
              : "border-line bg-white text-ink-secondary")
          }
        >
          전체 반
        </button>
        {CLASSES.map((c) => (
          <button
            key={c}
            onClick={() => toggleClass(c)}
            className={
              "rounded-lg border px-2.5 py-1.5 text-xs font-bold shadow-[0_1px_4px_rgba(20,30,60,0.10)] " +
              (classKeys.includes(c)
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-white text-ink-secondary")
            }
          >
            {c}
          </button>
        ))}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={(e) => commitContent(e.target.value)}
        placeholder="예: 모의고사, 여름특강 시작"
        className="min-h-[52px] w-full box-border rounded-lg border border-line px-2.5 py-2 text-xs"
      />
    </div>
  );
}
