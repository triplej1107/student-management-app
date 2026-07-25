"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CLASSES, type CalendarNote } from "@/lib/types";
import { useToast } from "@/components/Toast";
import {
  updateCalendarNoteFieldAction,
  deleteCalendarNoteAction,
} from "@/app/admin/students/calendar/actions";

export function CalendarNoteEditorRow({ note }: { note: CalendarNote }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [, startTransition] = useTransition();
  const [date, setDate] = useState(note.note_date);
  const [classKey, setClassKey] = useState(note.class_key ?? "");
  const [content, setContent] = useState(note.content);

  function commit(field: "note_date" | "class_key" | "content", value: string) {
    startTransition(async () => {
      await updateCalendarNoteFieldAction(note.id, field, value);
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
      <div className="mb-1.5 flex gap-1.5">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={(e) => commit("note_date", e.target.value)}
          className="flex-1 rounded-lg border border-line px-2.5 py-2 text-xs"
        />
        <select
          value={classKey}
          onChange={(e) => {
            setClassKey(e.target.value);
            commit("class_key", e.target.value);
          }}
          className="flex-1 rounded-lg border border-line bg-white px-2.5 py-2 text-xs"
        >
          <option value="">전체 반</option>
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={remove}
          className="rounded-lg border border-danger-soft bg-danger-soft px-3 py-2 text-xs font-bold text-danger"
        >
          삭제
        </button>
      </div>
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={(e) => commit("content", e.target.value)}
        placeholder="예: 모의고사, 여름특강 시작"
        className="w-full box-border rounded-lg border border-line px-2.5 py-2 text-xs"
      />
    </div>
  );
}
